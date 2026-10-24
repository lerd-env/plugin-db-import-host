const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { engineOf, siteDatabase, findClient } = require('../lib/host');
const { parseArgs } = require('../lib/args');

test('engineOf groups versioned services into their family', () => {
  assert.equal(engineOf('mysql'), 'mysql');
  assert.equal(engineOf('mariadb-11'), 'mysql');
  assert.equal(engineOf('postgres-pgvector'), 'postgres');
  assert.equal(engineOf('mysqlish'), null);
  assert.equal(engineOf('redis'), null);
});

test('siteDatabase picks the SQL service, not the first one', () => {
  const t = siteDatabase({ services: ['redis', 'postgres-18'], db_database: 'shop' });
  assert.deepEqual(t, { service: 'postgres-18', engine: 'postgres', database: 'shop' });
  assert.equal(siteDatabase({ services: ['mysql'] }), null);
});

test("findClient skips lerd's container shims for the real binary", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dbih-'));
  const shims = path.join(root, 'lerd-bin');
  const real = path.join(root, 'usr-bin');
  fs.mkdirSync(shims);
  fs.mkdirSync(real);
  fs.writeFileSync(path.join(shims, 'mysqldump'), '#!/bin/sh\n# lerd-managed service client shim\nexec lerd client-exec mysqldump "$@"\n', { mode: 0o755 });
  fs.writeFileSync(path.join(real, 'mariadb-dump'), '#!/bin/sh\n', { mode: 0o755 });
  assert.equal(findClient(['mysqldump', 'mariadb-dump'], [shims, real]), path.join(real, 'mariadb-dump'));
  assert.equal(findClient(['mysqldump'], [shims]), null);
  fs.rmSync(root, { recursive: true });
});

test('parseArgs reads values, inline values and booleans', () => {
  assert.deepEqual(parseArgs(['shop', '--from', 'old', '--all', '--port=3307'], ['all']), { _: ['shop'], from: 'old', all: true, port: '3307' });
  assert.throws(() => parseArgs(['--from']));
});

test('mariadbToMysql swaps MariaDB collations and sql_mode for MySQL ones', () => {
  const { mariadbToMysql } = require('../lib/host');
  assert.equal(
    mariadbToMysql(') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;'),
    ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;',
  );
  assert.equal(mariadbToMysql('`n` varchar(9) COLLATE utf8mb3_uca1400_as_cs'), '`n` varchar(9) COLLATE utf8mb3_general_ci');
  assert.equal(mariadbToMysql("INSERT INTO t VALUES ('utf8mb4_general_ci')"), "INSERT INTO t VALUES ('utf8mb4_general_ci')");
});

test('mariadbToMysql drops NO_AUTO_CREATE_USER from sql_mode only', () => {
  const { mariadbToMysql } = require('../lib/host');
  assert.equal(
    mariadbToMysql("/*!50003 SET sql_mode = 'STRICT_TRANS_TABLES,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;"),
    "/*!50003 SET sql_mode = 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION' */ ;",
  );
  assert.equal(mariadbToMysql("SET sql_mode = 'NO_AUTO_CREATE_USER'"), "SET sql_mode = ''");
  assert.equal(mariadbToMysql("INSERT INTO t VALUES ('NO_AUTO_CREATE_USER')"), "INSERT INTO t VALUES ('NO_AUTO_CREATE_USER')");
});
