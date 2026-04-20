import { brainTarget } from './brain.js';
import { anthropicTarget } from './anthropic.js';
import { genericHttpTarget } from './generic-http.js';
import { groqTarget } from './groq.js';

export function makeTarget(spec) {
  if (spec.target === 'brain')     return brainTarget(spec);
  if (spec.target === 'anthropic') return anthropicTarget(spec);
  if (spec.target === 'groq')      return groqTarget(spec);
  if (spec.target === 'http')      return genericHttpTarget(spec);
  throw new Error(`Unknown target: ${spec.target}`);
}
