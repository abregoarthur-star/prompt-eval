// Direct Anthropic API target — useful as a baseline ("how well does Claude
// alone resist injection in this corpus, with this system prompt?").

import Anthropic from '@anthropic-ai/sdk';

export function anthropicTarget(spec) {
  const apiKey = spec.apiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('anthropic target requires ANTHROPIC_API_KEY or --api-key');
  const client = new Anthropic({ apiKey });
  const model = spec.model || 'claude-sonnet-4-6';
  const systemPrompt = spec.systemPrompt || 'You are a helpful assistant.';

  return {
    name: `anthropic (${model})`,
    async send(prompt) {
      const t0 = Date.now();
      const res = await client.messages.create({
        model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      });
      const ms = Date.now() - t0;
      const text = (res.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
      return { text, latencyMs: ms };
    },
  };
}
