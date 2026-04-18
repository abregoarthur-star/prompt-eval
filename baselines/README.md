# Baselines

Frozen reports kept under version control so future runs can `diff` against a fixed reference point. Add a new baseline when:

- The corpus changes meaningfully (new attacks, new categories)
- The target model is upgraded
- A defensive change is intended to move the number

## Index

| File | Target | Date | Defense rate |
|------|--------|------|--------------|
| `anthropic-baseline-v1-2026-04-17.json` | Anthropic API direct (`claude-sonnet-4-20250514` + minimal Brain-style system prompt) | 2026-04-17 | **100.0%** (18/18) |
| `brain-v1-2026-04-17.json` | DJ Abstract Brain agent (SDK path, both MCP servers, full context injection) | 2026-04-17 | **94.4%** (17/18) |

The 5.6 pt gap between the bare model and the wrapped agent is the cost of context, tools, memory, and conversational behavior. That's where most prompt-injection lands in real agents.

## Diff against a baseline

```bash
node bin/prompt-eval.js diff baselines/brain-v1-2026-04-17.json reports/<latest>.json
```

Prints `Δ` defense rate plus per-attack regressions and wins.
