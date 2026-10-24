const test = require('node:test');
const assert = require('node:assert');
const { askConnection } = require('../lib/wizard');

// Answers questions in order; an empty answer takes the shown default, as a user pressing enter would.
function scripted(answers) {
  const asked = [];
  const ask = async (question, def = '', opts = {}) => {
    asked.push({ question, def, hidden: !!opts.hidden });
    return answers.shift() || def;
  };
  return { ask, asked };
}

test('askConnection keeps every default on enter and asks for no bin dir when the clients are found', async () => {
  const { ask, asked } = scripted([]);
  const { engine, conn } = await askConnection(ask, {}, () => true);
  assert.equal(engine, 'mysql');
  assert.deepEqual(conn, { host: '127.0.0.1', port: '3306', user: 'root' });
  assert.equal(asked.find((a) => /password/i.test(a.question)).hidden, true);
  assert.ok(!asked.some((a) => /folder/i.test(a.question)));
});

test('askConnection starts from the saved connection and keeps its password on an empty answer', async () => {
  const saved = { postgres: { port: '5433', password: 'old' } };
  const { ask } = scripted(['postgres', '', '', 'app', '', '/opt/pg/bin']);
  const { engine, conn } = await askConnection(ask, saved, () => false);
  assert.equal(engine, 'postgres');
  assert.deepEqual(conn, { host: '127.0.0.1', port: '5433', user: 'app', password: 'old', bin_dir: '/opt/pg/bin' });
});

test('askConnection refuses an engine it does not know', async () => {
  const { ask } = scripted(['oracle']);
  await assert.rejects(askConnection(ask, {}, () => true), /unknown engine oracle/);
});
