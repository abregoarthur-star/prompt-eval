// Generic HTTP target. POSTs the prompt to a URL with a configurable body
// template and a JSON-path-style response selector. Lets you point the harness
// at any LLM endpoint that takes a string in and returns text.

export function genericHttpTarget(spec) {
  if (!spec.url) throw new Error('http target requires --url');
  const headers = { 'Content-Type': 'application/json', ...(spec.headers || {}) };
  if (spec.bearer) headers.Authorization = `Bearer ${spec.bearer}`;

  const bodyKey = spec.bodyKey || 'prompt';
  const responseKey = spec.responseKey || 'response';

  return {
    name: `http (${spec.url})`,
    async send(prompt) {
      const t0 = Date.now();
      const res = await fetch(spec.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ [bodyKey]: prompt }),
      });
      const ms = Date.now() - t0;
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      }
      const data = await res.json();
      const text = pluck(data, responseKey);
      return { text: String(text ?? JSON.stringify(data)), latencyMs: ms };
    },
  };
}

function pluck(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}
