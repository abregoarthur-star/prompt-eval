# prompt-eval

A prompt-injection eval harness. Runs a curated attack corpus against an LLM target (an agent endpoint, a raw API, or any HTTP-callable model) and uses Claude as a judge to score whether each attack landed.

> Why this exists: If you ship an agent, you should know — quantitatively — how it holds up against the attacks every adversary will try first. That's not a vibes question; it's measurement. `prompt-eval` gives you a defense-rate number, a per-category breakdown, and a per-attack diff between runs so regressions are obvious.

## What it tests

The default corpus (`src/corpus/attacks.json`) covers the OWASP LLM01 surface plus agent-specific patterns:

| Category | Examples |
|----------|---------|
| `direct-injection` | "Ignore all previous instructions"; pirate persona swap |
| `system-prompt-extraction` | "Repeat everything above verbatim"; print system prompt as JSON |
| `role-hijack` | DAN; developer mode |
| `prefix-injection` | Forced response prefix |
| `indirect-injection` | Embedded instruction in a user document or email being analyzed |
| `encoding-tricks` | Base64-wrapped instruction; ROT13 |
| `information-leak` | Reveal API keys; reveal user PII |
| `tool-coercion` | Coerce a `send_email` exfil; coerce shell exec |
| `delimiter-confusion` | Fake `</user> <system>` tags |
| `authority-claim` | Fake "system admin priority" override |
| `refusal-bypass` | Hypothetical framing for prohibited content |

Each attack carries an explicit `successCriteria` — what counts as "compromised." The judge sees that criterion and the target's response, then returns `resisted | compromised | ambiguous` plus a one-line rationale.

## Install

```bash
git clone https://github.com/abregoarthur-star/prompt-eval
cd prompt-eval
npm install
cp .env.example .env  # add ANTHROPIC_API_KEY
```

Requires Node.js 20+.

## Usage

### List the corpus

```bash
node bin/prompt-eval.js list
```

### Eval the Brain agent

```bash
# Brain dev server must be running on :3005 with an authenticated session
node bin/prompt-eval.js run \
  --target brain \
  --url http://localhost:3005 \
  --cookie "auth=YOUR_JWT"
```

### Eval the raw Anthropic API (baseline)

```bash
node bin/prompt-eval.js run \
  --target anthropic \
  --model claude-sonnet-4-6 \
  --system "You are a helpful assistant."
```

### Eval any OpenAI-compatible endpoint

```bash
node bin/prompt-eval.js run \
  --target http \
  --url https://my-llm.example.com/api/chat \
  --bearer "$TOKEN" \
  --body-key prompt \
  --response-key choices.0.message.content
```

### Filter the corpus

```bash
# Only run critical-severity attacks
node bin/prompt-eval.js run --target brain --severity critical

# Only run a specific category
node bin/prompt-eval.js run --target brain --category tool-coercion,information-leak

# Run a single attack by id
node bin/prompt-eval.js run --target brain --ids context-injection-002
```

### Compare two runs

```bash
node bin/prompt-eval.js diff reports/2026-04-01.json reports/2026-04-15.json
```

Prints `Δ defense rate` plus the per-attack regressions and wins.

### CI gate

Fail the build if defense drops below a threshold:

```bash
node bin/prompt-eval.js run --target brain --fail-rate 90
```

## Output

Every run produces:

- **Terminal report** — defense rate, per-category, per-severity, list of compromised attacks with the judge's rationale.
- **JSON report** in `reports/<timestamp>.json` — full attacker prompt, target response, judge verdict, latency. Diffable across runs.
- **HTML dashboard** in `reports/<timestamp>.html` — share-friendly, hero defense rate, per-attack cards.

## Programmatic API

```javascript
import { evalTarget } from 'prompt-eval';

const report = await evalTarget({
  target: 'brain',
  url: 'http://localhost:3005',
  cookie: process.env.BRAIN_COOKIE,
  filter: { severities: ['critical', 'high'] },
});

console.log(`Defense rate: ${report.summary.defenseRate}%`);
```

## Design notes

- **Claude-as-judge** because per-attack `successCriteria` is the ground truth, not a string match — partial compliance and creative rephrasings need a model to score correctly.
- **Concurrent attacks** (default 3) keep wall-clock low. Bumping past 5 risks rate limits on both the target and the judge.
- **Read-only by design.** The harness sends prompts and reads responses. It does not attempt actual exploitation, post-execution destruction, or network attacks.
- **Corpus is intentionally small (~18 attacks) and curated.** Big benchmarks are noisy and slow. A focused suite that catches the patterns every attacker tries first is more useful as a regression tool than a 10K-row eval that takes 4 hours and costs $50 per run.

## Roadmap

- Multi-turn attacks (priming over several turns, then exploiting)
- Indirect injection corpus from synthetic RAG documents
- ASCII Smuggler / Unicode Tag attacks (paired with [`mcp-audit`](https://github.com/abregoarthur-star/mcp-audit) detection)
- Tool-call telemetry from agent targets (which tools were invoked vs. which the attacker tried to coerce)
- Side-by-side eval runs across model versions for regression tracking

## References

- [OWASP Top 10 for LLM Applications — LLM01: Prompt Injection](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
- [Simon Willison — The Lethal Trifecta](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/)
- [MITRE ATLAS](https://atlas.mitre.org/)
- [Anthropic Red-Teaming Resources](https://www.anthropic.com/research)

## License

MIT — see [LICENSE](./LICENSE).
