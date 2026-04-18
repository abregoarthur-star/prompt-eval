const VERDICT_COLOR = {
  resisted:    '#16a34a',
  compromised: '#dc2626',
  ambiguous:   '#6b7280',
};

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function rateBadge(resisted, total) {
  const rate = total ? Math.round(resisted / total * 100) : 0;
  const color = rate >= 90 ? '#16a34a' : rate >= 70 ? '#d97706' : '#dc2626';
  return `<span class="rate" style="background:${color}">${rate}%</span>`;
}

export function renderHtml(report) {
  const s = report.summary;
  const overallColor = s.defenseRate >= 90 ? '#16a34a' : s.defenseRate >= 70 ? '#d97706' : '#dc2626';

  const categoryRows = Object.entries(report.byCategory).map(([cat, c]) => `
    <tr>
      <td>${escapeHtml(cat)}</td>
      <td>${rateBadge(c.resisted, c.total)}</td>
      <td>${c.resisted}/${c.total}</td>
      <td><span class="dot resisted"></span>${c.resisted}</td>
      <td><span class="dot compromised"></span>${c.compromised}</td>
      <td><span class="dot ambiguous"></span>${c.ambiguous}</td>
    </tr>
  `).join('');

  const severityRows = ['critical', 'high', 'medium', 'low']
    .filter(sev => report.bySeverity[sev])
    .map(sev => {
      const c = report.bySeverity[sev];
      return `
        <tr>
          <td>${escapeHtml(sev)}</td>
          <td>${rateBadge(c.resisted, c.total)}</td>
          <td>${c.resisted}/${c.total}</td>
        </tr>
      `;
    }).join('');

  const findingCards = report.results.map(r => {
    const v = r.score?.verdict || 'ambiguous';
    return `
      <article class="finding v-${v}">
        <header>
          <span class="badge" style="background:${VERDICT_COLOR[v]}">${escapeHtml(v)}</span>
          <h3>${escapeHtml(r.attack.id)} — ${escapeHtml(r.attack.name)}</h3>
        </header>
        <div class="meta">category: <code>${escapeHtml(r.attack.category)}</code> · severity: <code>${escapeHtml(r.attack.severity)}</code> · latency: ${r.targetLatencyMs}ms</div>
        ${r.score?.rationale ? `<div class="rationale"><strong>Judge:</strong> ${escapeHtml(r.score.rationale)}</div>` : ''}
        <details>
          <summary>Response</summary>
          <pre>${escapeHtml(r.targetResponse || (r.targetError && '[target error: ' + r.targetError + ']') || '')}</pre>
        </details>
      </article>
    `;
  }).join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prompt-Injection Eval · ${escapeHtml(report.target)}</title>
  <style>
    :root { --bg:#0b0f17; --panel:#111827; --border:#1f2937; --text:#e5e7eb; --dim:#94a3b8; --accent:#22d3ee; }
    * { box-sizing:border-box; }
    body { margin:0; font-family: ui-sans-serif, system-ui, sans-serif; background:var(--bg); color:var(--text); line-height:1.5; }
    .wrap { max-width:1024px; margin:0 auto; padding:32px 24px 64px; }
    h1 { margin:0 0 8px; font-size:28px; }
    h2 { margin:32px 0 12px; font-size:14px; color:var(--accent); letter-spacing:0.08em; text-transform:uppercase; }
    h3 { margin:0; font-size:15px; }
    .meta { font-size:12px; color:var(--dim); margin:6px 0 8px; }
    code { background:#1f2937; padding:1px 6px; border-radius:4px; font-size:12px; }
    .target { background:var(--panel); border:1px solid var(--border); border-radius:10px; padding:18px 20px; margin-top:8px; }
    .target .row { display:flex; gap:24px; flex-wrap:wrap; font-size:13px; color:var(--dim); }
    .target .row b { color:var(--text); font-weight:600; margin-right:6px; }
    .hero { display:flex; align-items:center; gap:24px; margin-top:16px; padding:24px;
            background:var(--panel); border:1px solid var(--border); border-radius:10px; }
    .hero-rate { font-size:48px; font-weight:800; color:${overallColor}; line-height:1; }
    .hero-meta { font-size:13px; color:var(--dim); }
    .hero-meta b { color:var(--text); font-weight:600; }
    table { width:100%; border-collapse:collapse; background:var(--panel); border:1px solid var(--border); border-radius:8px; overflow:hidden; }
    th, td { text-align:left; padding:10px 14px; border-bottom:1px solid var(--border); font-size:13px; }
    th { background:#0f1726; font-size:11px; color:var(--dim); text-transform:uppercase; letter-spacing:0.06em; }
    tr:last-child td { border-bottom:0; }
    .rate { display:inline-block; padding:2px 10px; border-radius:999px; font-size:11px; font-weight:700; color:#fff; }
    .dot { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:6px; vertical-align:baseline; }
    .dot.resisted { background:#16a34a; }
    .dot.compromised { background:#dc2626; }
    .dot.ambiguous { background:#6b7280; }
    .finding { background:var(--panel); border:1px solid var(--border); border-left-width:4px;
               border-radius:8px; padding:14px 18px; margin:10px 0; }
    .finding.v-resisted    { border-left-color:#16a34a; }
    .finding.v-compromised { border-left-color:#dc2626; }
    .finding.v-ambiguous   { border-left-color:#6b7280; }
    .finding header { display:flex; align-items:center; gap:10px; margin-bottom:6px; }
    .badge { font-size:10px; font-weight:700; letter-spacing:0.06em; padding:2px 8px; border-radius:999px; color:#fff; text-transform:uppercase; }
    .rationale { font-size:13px; color:var(--text); margin:6px 0; }
    pre { background:#0a0e16; border:1px solid var(--border); border-radius:6px; padding:8px 10px;
          overflow:auto; font-size:12px; color:#cbd5e1; white-space:pre-wrap; word-break:break-word; max-height:300px; }
    details summary { cursor:pointer; color:var(--dim); font-size:12px; margin-top:4px; }
    .footer { margin-top:32px; font-size:12px; color:var(--dim); text-align:center; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Prompt-Injection Eval</h1>
    <div class="target">
      <div class="row"><div><b>Target</b>${escapeHtml(report.target)}</div></div>
      <div class="row"><div><b>Judge</b>${escapeHtml(report.judge)}</div><div><b>Run at</b>${escapeHtml(report.runAt)}</div></div>
    </div>

    <div class="hero">
      <div class="hero-rate">${s.defenseRate}%</div>
      <div class="hero-meta">
        <div><b>Defense rate</b> — ${s.resisted} of ${s.total} attacks resisted</div>
        <div style="margin-top:6px">
          <span class="dot resisted"></span>${s.resisted} resisted ·
          <span class="dot compromised"></span>${s.compromised} compromised ·
          <span class="dot ambiguous"></span>${s.ambiguous} ambiguous
        </div>
      </div>
    </div>

    <h2>By category</h2>
    <table>
      <thead><tr><th>Category</th><th>Defense</th><th>Score</th><th>Resisted</th><th>Compromised</th><th>Ambig.</th></tr></thead>
      <tbody>${categoryRows}</tbody>
    </table>

    <h2>By severity</h2>
    <table>
      <thead><tr><th>Severity</th><th>Defense</th><th>Score</th></tr></thead>
      <tbody>${severityRows}</tbody>
    </table>

    <h2>Per-attack results (${report.results.length})</h2>
    ${findingCards}

    <div class="footer">prompt-eval</div>
  </div>
</body>
</html>`;
}
