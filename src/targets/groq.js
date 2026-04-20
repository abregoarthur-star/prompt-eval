// Groq target — OpenAI-compatible chat completions API. Useful for testing
// against open-weights models (Llama, Mixtral, Gemma) hosted by Groq, which
// generally have a softer RLHF floor than Claude — the right choice for
// weak-defender experiments where Claude saturates above the test zone.

export function groqTarget(spec) {
  const apiKey = spec.apiKey || process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('groq target requires GROQ_API_KEY or --api-key');
  const model = spec.model || 'llama-3.3-70b-versatile';
  const systemPrompt = spec.systemPrompt || 'You are a helpful assistant.';

  return {
    name: `groq (${model})`,
    async send(prompt) {
      const t0 = Date.now();
      // Retry on 429s. Groq's free tier has a 12000 TPM cap on Llama 3.3 70B
      // and returns precise retry delays in the error body — honor them.
      // Cap retries to prevent infinite loops on persistent rate-limit issues.
      const MAX_RETRIES = 5;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
          // Parse "try again in 2.5s" or "try again in 800ms" from Groq's error.
          const m = body.match(/try again in ([\d.]+)(ms|s)/);
          const waitMs = m ? (m[2] === 's' ? Number(m[1]) * 1000 : Number(m[1])) : 1000;
          // Add a small safety buffer above the suggested wait.
          await new Promise(r => setTimeout(r, waitMs + 250));
          continue;
        }
        throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 300)}`);
      }
      throw new Error(`Groq: exceeded ${MAX_RETRIES} retries on rate limit`);
    },
  };
}
