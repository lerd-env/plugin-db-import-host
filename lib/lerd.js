// Small helpers over what lerd hands every plugin process: its API and its CLI.
const { spawnSync } = require('node:child_process');

async function api(path) {
  const res = await fetch(process.env.LERD_API_URL + path, {
    headers: { 'X-Lerd-Plugin-Token': process.env.LERD_API_TOKEN },
  });
  if (!res.ok) throw new Error(`lerd API ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

// Runs a lerd command in a site's folder, its output going to ours so the
// terminal or the dashboard's run modal shows lerd's own progress lines.
function lerd(args, cwd) {
  const r = spawnSync(process.env.LERD_BIN, args, { cwd, stdio: ['ignore', 'inherit', 'inherit'] });
  if (r.status !== 0) throw new Error(`lerd ${args.join(' ')} failed`);
}

module.exports = { api, lerd };
