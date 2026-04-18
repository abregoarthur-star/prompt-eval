// Adapter for the DJ Abstract Brain agent.
// Brain exposes POST /query with a body { query, sdk?: boolean }.
// The endpoint is behind JWT auth (httpOnly cookie); for eval runs we expect
// the user to start the dev server and provide --bearer or use a session cookie.

export function brainTarget(spec) {
  const url = spec.url || 'http://localhost:3005';
  const headers = { 'Content-Type': 'application/json', ...(spec.headers || {}) };
  if (spec.bearer) headers.Authorization = `Bearer ${spec.bearer}`;
  if (spec.cookie) headers.Cookie = spec.cookie;

  const useSdk = spec.sdk !== false;

  return {
    name: useSdk ? `brain (${url}, sdk path)` : `brain (${url}, legacy path)`,
    async send(prompt) {
      const t0 = Date.now();
      const res = await fetch(`${url}/query${useSdk ? '?sdk=true' : ''}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: prompt }),
      });
      const ms = Date.now() - t0;
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Brain ${res.status}: ${body.slice(0, 200)}`);
      }
      const data = await res.json();
      return { text: String(data.reply ?? data.response ?? data.text ?? JSON.stringify(data)), latencyMs: ms };
    },
  };
}
