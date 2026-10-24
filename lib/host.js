// Everything about the database server installed on the machine itself: which
// of lerd's services a site's data belongs to, finding the server's own client
// tools, and the connection details saved with `connect`.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ENGINES = {
  mysql: {
    dump: ['mysqldump', 'mariadb-dump'],
    query: ['mysql', 'mariadb'],
    defaults: { host: '127.0.0.1', port: '3306', user: 'root' },
    system: ['information_schema', 'mysql', 'performance_schema', 'sys'],
  },
  postgres: {
    dump: ['pg_dump'],
    query: ['psql'],
    defaults: { host: '127.0.0.1', port: '5432', user: 'postgres' },
    system: ['postgres'],
  },
};

// The engine a lerd service speaks, from its name: mysql, mariadb and their
// versioned variants are one family, postgres and its variants the other.
function engineOf(service) {
  if (/^(mysql|mariadb)(-|$)/.test(service)) return 'mysql';
  if (/^postgres(-|$)/.test(service)) return 'postgres';
  return null;
}

function siteDatabase(site) {
  const service = (site.services || []).find((s) => engineOf(s));
  if (!service || !site.db_database) return null;
  return { service, engine: engineOf(service), database: site.db_database };
}

// lerd puts shims named mysqldump, pg_dump and so on in its bin folder that
// run the tool inside lerd's own containers, where the machine's server is out
// of reach, so a client counts only when it is the real binary.
function isLerdShim(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(256);
    const n = fs.readSync(fd, buf, 0, 256, 0);
    return /lerd client-exec|lerd-managed service client shim/.test(buf.subarray(0, n).toString());
  } finally {
    fs.closeSync(fd);
  }
}

function findClient(names, dirs) {
  for (const dir of dirs) {
    for (const name of names) {
      const file = path.join(dir, name);
      try {
        fs.accessSync(file, fs.constants.X_OK);
        if (fs.statSync(file).isFile() && !isLerdShim(file)) return file;
      } catch {}
    }
  }
  return null;
}

function settingsFile() {
  return path.join(process.env.LERD_PLUGIN_DATA, 'connection.json');
}

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return {};
    throw e;
  }
}

function saveSettings(settings) {
  fs.mkdirSync(process.env.LERD_PLUGIN_DATA, { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2) + '\n', { mode: 0o600 });
}

function connection(engine) {
  const saved = loadSettings();
  const conn = { ...ENGINES[engine].defaults, ...(saved[engine] || {}) };
  const dirs = [conn.bin_dir, ...(process.env.PATH || '').split(path.delimiter)].filter(Boolean);
  const dump = findClient(ENGINES[engine].dump, dirs);
  const query = findClient(ENGINES[engine].query, dirs);
  if (!dump || !query) {
    throw new Error(
      `no ${ENGINES[engine].dump[0]} and ${ENGINES[engine].query[0]} of the machine's own were found on PATH; ` +
        `point at the folder holding them with: lerd db-import-host:connect ${engine} --bin-dir <dir>`,
    );
  }
  return { ...conn, dump, query };
}

function connArgs(engine, c) {
  if (engine === 'mysql') {
    const where = c.socket ? ['--socket', c.socket] : ['-h', c.host, '-P', String(c.port)];
    return [...where, '-u', c.user];
  }
  return ['-h', c.socket || c.host, '-p', String(c.port), '-U', c.user];
}

function clientEnv(engine, c) {
  const env = { ...process.env };
  if (c.password) env[engine === 'mysql' ? 'MYSQL_PWD' : 'PGPASSWORD'] = c.password;
  return env;
}

function run(file, args, env, out) {
  const r = spawnSync(file, args, { env, stdio: ['ignore', out ?? 'pipe', 'pipe'], maxBuffer: 64 << 20 });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${path.basename(file)}: ${String(r.stderr).trim() || 'exit ' + r.status}`);
  return String(r.stdout ?? '');
}

function listDatabases(engine) {
  const c = connection(engine);
  const args =
    engine === 'mysql'
      ? [...connArgs(engine, c), '-N', '-B', '-e', 'SHOW DATABASES']
      : [...connArgs(engine, c), '-d', 'postgres', '-At', '-c', 'SELECT datname FROM pg_database WHERE NOT datistemplate'];
  return run(c.query, args, clientEnv(engine, c))
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !ENGINES[engine].system.includes(l));
}

function dumpTo(engine, database, file) {
  const c = connection(engine);
  const args =
    engine === 'mysql'
      ? [...connArgs(engine, c), '--single-transaction', '--routines', '--triggers', '--no-tablespaces', database]
      : [...connArgs(engine, c), '--no-owner', '--no-privileges', '-d', database];
  const fd = fs.openSync(file, 'w', 0o600);
  try {
    run(c.dump, args, clientEnv(engine, c), fd);
  } finally {
    fs.closeSync(fd);
  }
}

// A MariaDB dump carries two things MySQL 8 refuses outright: its uca1400
// collations (ERROR 1273) and NO_AUTO_CREATE_USER in a trigger's or routine's
// sql_mode (ERROR 1231). A dump headed for a MySQL service gets MySQL's own.
function mariadbToMysql(line) {
  return line
    .replace(/\butf8mb4_uca1400_\w+/g, 'utf8mb4_0900_ai_ci')
    .replace(/\butf8mb3_uca1400_\w+/g, 'utf8mb3_general_ci')
    .replace(/(sql_mode\s*=\s*'[^']*)/g, (m) => m.replace(/NO_AUTO_CREATE_USER,?|,NO_AUTO_CREATE_USER/g, ''));
}

async function rewriteFile(file, fn) {
  const readline = require('node:readline');
  const tmp = file + '.rewrite';
  const out = fs.createWriteStream(tmp, { mode: 0o600 });
  for await (const line of readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity })) {
    if (!out.write(fn(line) + '\n')) await new Promise((r) => out.once('drain', r));
  }
  await new Promise((r, j) => out.end((e) => (e ? j(e) : r())));
  fs.renameSync(tmp, file);
}

module.exports = { mariadbToMysql, rewriteFile, ENGINES, engineOf, siteDatabase, findClient, loadSettings, saveSettings, listDatabases, dumpTo };
