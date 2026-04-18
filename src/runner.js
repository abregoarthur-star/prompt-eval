// Orchestrates running every attack against the target and scoring with the judge.

export async function runEval({ target, judge, corpus, concurrency = 3, onProgress }) {
  const queue = [...corpus];
  const results = [];
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, queue.length)) }, () => worker());

  async function worker() {
    while (queue.length) {
      const attack = queue.shift();
      const result = await runOne(attack, target, judge);
      results.push(result);
      if (onProgress) onProgress(result, results.length, corpus.length);
    }
  }

  await Promise.all(workers);

  results.sort((a, b) => corpus.findIndex(c => c.id === a.attack.id) - corpus.findIndex(c => c.id === b.attack.id));

  return summarize({ target, judge, results });
}

async function runOne(attack, target, judge) {
  const result = {
    attack: { id: attack.id, category: attack.category, severity: attack.severity, name: attack.name },
    targetResponse: '',
    targetLatencyMs: 0,
    targetError: null,
    score: null,
    judgeError: null,
  };

  try {
    const { text, latencyMs } = await target.send(attack.prompt);
    result.targetResponse = text;
    result.targetLatencyMs = latencyMs;
  } catch (e) {
    result.targetError = e.message;
    result.score = { verdict: 'ambiguous', confidence: 1, rationale: `target errored: ${e.message}` };
    return result;
  }

  try {
    result.score = await judge.score({ attack, response: result.targetResponse });
  } catch (e) {
    result.judgeError = e.message;
    result.score = { verdict: 'ambiguous', confidence: 0, rationale: `judge errored: ${e.message}` };
  }
  return result;
}

function summarize({ target, judge, results }) {
  const total = results.length;
  const compromised = results.filter(r => r.score?.verdict === 'compromised').length;
  const resisted    = results.filter(r => r.score?.verdict === 'resisted').length;
  const ambiguous   = results.filter(r => r.score?.verdict === 'ambiguous').length;
  const defenseRate = total ? +(resisted / total * 100).toFixed(1) : 0;

  const byCategory = {};
  for (const r of results) {
    const cat = r.attack.category;
    if (!byCategory[cat]) byCategory[cat] = { total: 0, resisted: 0, compromised: 0, ambiguous: 0 };
    byCategory[cat].total++;
    byCategory[cat][r.score?.verdict || 'ambiguous']++;
  }

  const bySeverity = {};
  for (const r of results) {
    const sev = r.attack.severity;
    if (!bySeverity[sev]) bySeverity[sev] = { total: 0, resisted: 0, compromised: 0, ambiguous: 0 };
    bySeverity[sev].total++;
    bySeverity[sev][r.score?.verdict || 'ambiguous']++;
  }

  return {
    runAt: new Date().toISOString(),
    target: target.name,
    judge: judge.name,
    summary: { total, resisted, compromised, ambiguous, defenseRate },
    byCategory,
    bySeverity,
    results,
  };
}
