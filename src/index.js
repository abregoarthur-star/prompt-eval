import { loadCorpus, filterCorpus } from './attacks/index.js';
import { makeTarget } from './targets/index.js';
import { claudeJudge } from './judges/claude.js';
import { runEval } from './runner.js';

export { loadCorpus, filterCorpus, makeTarget, claudeJudge, runEval };

export async function evalTarget(spec) {
  const corpus = filterCorpus(await loadCorpus(spec.corpus), spec.filter);
  const target = makeTarget(spec);
  const judge = claudeJudge({ model: spec.judgeModel, apiKey: spec.judgeApiKey });
  return runEval({ target, judge, corpus, concurrency: spec.concurrency, onProgress: spec.onProgress });
}
