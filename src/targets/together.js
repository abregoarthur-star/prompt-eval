// Together AI target — OpenAI-compatible chat completions API. Hosts a
// broader open-weights catalog than Groq (Llama 3.1 70B/405B Instruct,
// Mixtral 8x22B, Hermes 3, Qwen, etc.) including non-RLHF base variants
// useful for the cross-provider refusal-rate experiment from Addendum 3:
// measure which generators refuse to write which attack categories, on the
// hypothesis that Claude won't write the attacks it was trained to resist.
//
// Same retry pattern as the Groq adapter — Together's free tier rate-limits
// hot models with similar structure, and the "try again in Xs" hint format
// is OpenAI-standard.

export function togetherTarget(spec) {
  const apiKey = spec.apiKey || process.env.TOGETHER_API_KEY;
  if (!apiKey) throw new Error('together target requires TOGETHER_API_KEY or --api-key');
  const model = spec.model || 'meta-llama/Llama-3.1-70B-Instruct-Turbo';
  const systemPrompt = spec.systemPrompt || 'You are a helpful assistant.';

  return {
    name: `together (${model})`,
    async send(prompt) {
      const t0 = Date.now();
      const MAX_RETRIES = 5;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const res = await fetch('https://api.together.xyz/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt },
            ],
            max_tokens: 1024,
            temperature: 0.3,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const text = data.choices?.[0]?.message?.content ?? '';
          return { text, latencyMs: Date.now() - t0 };
        }
        if (res.status === 429 && attempt < MAX_RETRIES) {
          const body = await res.text();
          const m = body.match(/try again in ([\d.]+)(ms|s)/i);
          // Together's hint format isn't always present — fall back to
          // exponential backoff if no parseable suggestion.
          const waitMs = m
            ? (m[2].toLowerCase() === 's' ? Number(m[1]) * 1000 : Number(m[1]))
            : Math.min(1000 * 2 ** attempt, 8000);
          await new Promise(r => setTimeout(r, waitMs + 250));
          continue;
        }
        throw new Error(`Together ${res.status}: ${(await res.text()).slice(0, 300)}`);
      }
      throw new Error(`Together: exceeded ${MAX_RETRIES} retries on rate limit`);
    },
  };
}
