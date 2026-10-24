// `--key value` and bare `--flag` options, everything else positional.
function parseArgs(argv, booleans = []) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      out._.push(a);
      continue;
    }
    const [key, inline] = a.slice(2).split(/=(.*)/s);
    if (booleans.includes(key)) out[key] = true;
    else if (inline !== undefined) out[key] = inline;
    else if (i + 1 < argv.length) out[key] = argv[++i];
    else throw new Error(`--${key} needs a value`);
  }
  return out;
}

// MCP tools get their arguments as JSON on stdin, every other surface on argv.
function mcpInput() {
  if (process.env.LERD_SURFACE !== 'mcp') return null;
  const raw = require('node:fs').readFileSync(0, 'utf8').trim();
  return raw ? JSON.parse(raw) : {};
}

module.exports = { parseArgs, mcpInput };
