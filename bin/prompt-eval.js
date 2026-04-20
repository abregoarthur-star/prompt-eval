#!/usr/bin/env node
import { writeFile, readdir, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { evalTarget, loadCorpus } from '../src/index.js';
import { renderTerminal } from '../src/reporters/terminal.js';
import { renderHtml } from '../src/reporters/html.js';

const HELP = `prompt-eval — prompt-injection eval harness

Usage:
  prompt-eval run --target <brain|anthropic|groq|together|http> [options]
  prompt-eval list                                 List the attack corpus
  prompt-eval report <run.json>                    Re-render a stored report
  prompt-eval diff <a.json> <b.json>               Compare two runs

Run options:
  --target <name>             brain | anthropic | groq | together | http (required)
  --url <url>                 Target URL (brain | http)
  --bearer <token>            Bearer token for the target
  --cookie <cookie>           Cookie header (brain auth)
  --sdk / --no-sdk            Brain: use the SDK path (default true)
  --api-key <key>             API key (overrides ANTHROPIC_API_KEY / GROQ_API_KEY / TOGETHER_API_KEY)
  --model <name>              Target model (anthropic | groq | together)
  --system <text>             System prompt (anthropic | groq | together)
  --body-key <key>            HTTP target: request body key (default 'prompt')
  --response-key <path>       HTTP target: response key path (default 'response')
  --judge-model <name>        Judge model (default \$JUDGE_MODEL or claude-sonnet-4-6)
  --concurrency <n>           Parallel attacks (default 3)
  --category <list>           Comma-separated categories to include
  --severity <list>           Comma-separated severities (critical,high,medium,low)
  --ids <list>                Comma-separated attack IDs
  --corpus <path>             Use a custom corpus JSON
  --json [path]               Save JSON report (defaults to reports/<ts>.json)
  --html [path]               Save HTML report (defaults to reports/<ts>.html)
  --quiet                     Suppress terminal output
  --fail-rate <n>             Exit non-zero if defense rate < n (0-100)
  -h, --help

Examples:
  prompt-eval run --target brain --url http://localhost:3005 --cookie "auth=..."
  prompt-eval run --target anthropic --model claude-sonnet-4-6 --system "You are X"
  prompt-eval run --target groq --model llama-3.3-70b-versatile --system "You are X"
  prompt-eval run --target together --model meta-llama/Llama-3.1-70B-Instruct-Turbo --system "You are X"
  prompt-eval run --target http --url http://x.com/api --body-key q --response-key data.text
  prompt-eval list
  prompt-eval diff reports/2026-04-01.json reports/2026-04-15.json
`;

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === '-h' || argv[0] === '--help') {
    process.stdout.write(HELP); process.exit(0);
  }

  const cmd = argv[0];
  if (cmd === 'list') return cmdList(argv.slice(1));
  if (cmd === 'report') return cmdReport(argv.slice(1));
  if (cmd === 'diff') return cmdDiff(argv.slice(1));
  if (cmd === 'run') return cmdRun(argv.slice(1));
  process.stderr.write(`Unknown command: ${cmd}\n\n${HELP}`);
  process.exit(2);
}

async function cmdList(args) {
  const path = args[0] || null;
  const corpus = await loadCorpus(path);
  for (const a of corpus) {
    process.stdout.write(`${a.id.padEnd(28)} ${a.severity.padEnd(8)} ${a.category.padEnd(28)} ${a.name}\n`);
  }
  process.stdout.write(`\n${corpus.length} attacks loaded.\n`);
}

async function cmdReport(args) {
  const path = args[0];
  if (!path) { process.stderr.write('Usage: prompt-eval report <path>\n'); process.exit(2); }
  const report = JSON.parse(await readFile(path, 'utf8'));
  process.stdout.write(renderTerminal(report));
}

async function cmdDiff(args) {
  const [aPath, bPath] = args;
  if (!aPath || !bPath) { process.stderr.write('Usage: prompt-eval diff <a.json> <b.json>\n'); process.exit(2); }
  const a = JSON.parse(await readFile(aPath, 'utf8'));
  const b = JSON.parse(await readFile(bPath, 'utf8'));
  const delta = b.summary.defenseRate - a.summary.defenseRate;
  process.stdout.write(`A: ${a.runAt}  ${a.summary.defenseRate}% (${a.summary.resisted}/${a.summary.total})\n`);
  process.stdout.write(`B: ${b.runAt}  ${b.summary.defenseRate}% (${b.summary.resisted}/${b.summary.total})\n`);
  process.stdout.write(`Δ: ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} pts\n\n`);

  const aById = new Map(a.results.map(r => [r.attack.id, r.score?.verdict]));
  const regressions = b.results.filter(r => r.score?.verdict === 'compromised' && aById.get(r.attack.id) === 'resisted');
  const wins = b.results.filter(r => r.score?.verdict === 'resisted' && aById.get(r.attack.id) === 'compromised');
  if (regressions.length) {
    process.stdout.write(`Regressions (${regressions.length}):\n`);
    for (const r of regressions) process.stdout.write(`  ✗ ${r.attack.id}  ${r.attack.name}\n`);
    process.stdout.write('\n');
  }
  if (wins.length) {
    process.stdout.write(`Wins (${wins.length}):\n`);
    for (const r of wins) process.stdout.write(`  ✓ ${r.attack.id}  ${r.attack.name}\n`);
  }
}

async function cmdRun(args) {
  const opts = parseArgs(args);
  if (opts.help) { process.stdout.write(HELP); process.exit(0); }
  if (!opts.target) { process.stderr.write('Missing --target\n'); process.exit(2); }

  const spec = {
    target: opts.target,
    url: opts.url,
    bearer: opts.bearer,
    cookie: opts.cookie,
    sdk: opts.sdk,
    apiKey: opts.apiKey,
    model: opts.model,
    systemPrompt: opts.system,
    bodyKey: opts.bodyKey,
    responseKey: opts.responseKey,
    judgeModel: opts.judgeModel,
    concurrency: opts.concurrency || 3,
    corpus: opts.corpus,
    filter: {
      categories: opts.category?.split(',').map(s => s.trim()),
      severities: opts.severity?.split(',').map(s => s.trim()),
      ids:        opts.ids?.split(',').map(s => s.trim()),
    },
    onProgress: (r, n, total) => {
      const v = r.score?.verdict || '?';
      const symbol = v === 'resisted' ? '✓' : v === 'compromised' ? '✗' : '·';
      process.stderr.write(`  [${n}/${total}] ${symbol} ${r.attack.id} (${v})\n`);
    },
  };

  let report;
  try {
    report = await evalTarget(spec);
  } catch (e) {
    process.stderr.write(`Eval failed: ${e.message}\n`);
    if (process.env.DEBUG) console.error(e);
    process.exit(2);
  }

  if (!opts.quiet) process.stdout.write(renderTerminal(report));

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const reportsDir = resolve(process.cwd(), 'reports');
  if (opts.json !== false) {
    const path = typeof opts.json === 'string' ? opts.json : join(reportsDir, `${ts}.json`);
    await writeFile(path, JSON.stringify(report, null, 2));
    process.stderr.write(`JSON report: ${path}\n`);
  }
  if (opts.html !== false) {
    const path = typeof opts.html === 'string' ? opts.html : join(reportsDir, `${ts}.html`);
    await writeFile(path, renderHtml(report));
    process.stderr.write(`HTML report: ${path}\n`);
  }

  if (opts.failRate !== undefined && report.summary.defenseRate < opts.failRate) {
    process.exit(1);
  }
}

function parseArgs(args) {
  const out = { sdk: true, json: undefined, html: undefined };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const next = () => args[++i];
    switch (a) {
      case '--target':       out.target = next(); break;
      case '--url':          out.url = next(); break;
      case '--bearer':       out.bearer = next(); break;
      case '--cookie':       out.cookie = next(); break;
      case '--sdk':          out.sdk = true; break;
      case '--no-sdk':       out.sdk = false; break;
      case '--api-key':      out.apiKey = next(); break;
      case '--model':        out.model = next(); break;
      case '--system':       out.system = next(); break;
      case '--body-key':     out.bodyKey = next(); break;
      case '--response-key': out.responseKey = next(); break;
      case '--judge-model':  out.judgeModel = next(); break;
      case '--concurrency':  out.concurrency = parseInt(next(), 10); break;
      case '--category':     out.category = next(); break;
      case '--severity':     out.severity = next(); break;
      case '--ids':          out.ids = next(); break;
      case '--corpus':       out.corpus = next(); break;
      case '--json': {
        const peek = args[i + 1];
        out.json = (peek && !peek.startsWith('--')) ? next() : true;
        break;
      }
      case '--html': {
        const peek = args[i + 1];
        out.html = (peek && !peek.startsWith('--')) ? next() : true;
        break;
      }
      case '--quiet':        out.quiet = true; break;
      case '--fail-rate':    out.failRate = parseFloat(next()); break;
      case '-h':
      case '--help':         out.help = true; break;
      default:
        process.stderr.write(`Unknown arg: ${a}\n`);
        process.exit(2);
    }
  }
  // Default: write both reports
  if (out.json === undefined) out.json = true;
  if (out.html === undefined) out.html = true;
  return out;
}

main().catch(e => {
  process.stderr.write(`Fatal: ${e.message}\n`);
  if (process.env.DEBUG) console.error(e);
  process.exit(2);
});
