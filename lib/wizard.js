// The questions `connect` asks when run without flags. `ask(question, default,
// { hidden })` returns the answer, or the default when the user just presses enter.
const { ENGINES } = require('./host');

async function askConnection(ask, settings, hasClients) {
  const engine = await ask('Server (mysql or postgres)', 'mysql');
  if (!ENGINES[engine]) throw new Error(`unknown engine ${engine}, use mysql or postgres`);
  const conn = { ...ENGINES[engine].defaults, ...(settings[engine] || {}) };
  conn.host = await ask('Host', conn.host);
  conn.port = await ask('Port', conn.port);
  conn.user = await ask('User', conn.user);
  // An empty answer keeps the saved password, so it never has to be shown as a default.
  const password = await ask(conn.password ? 'Password (enter keeps the saved one)' : 'Password (enter for none)', '', { hidden: true });
  if (password) conn.password = password;
  if (!hasClients(engine, conn.bin_dir)) {
    const { dump, query } = ENGINES[engine];
    conn.bin_dir = await ask(`Folder holding ${dump[0]} and ${query[0]}`, conn.bin_dir || '');
  }
  return { engine, conn };
}

module.exports = { askConnection };
