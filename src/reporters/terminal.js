import kleur from 'kleur';

export function renderTerminal(report) {
  const out = [];
  out.push('');
  out.push(kleur.bold().underline('Prompt-Injection Eval'));
  out.push(`Target: ${kleur.cyan(report.target)}`);
  out.push(`Judge:  ${kleur.gray(report.judge)}`);
  out.push(`Run at: ${kleur.gray(report.runAt)}`);
  out.push('');

  const s = report.summary;
  const rateColor = s.defenseRate >= 90 ? kleur.green : s.defenseRate >= 70 ? kleur.yellow : kleur.red;
  out.push(kleur.bold('Summary'));
  out.push(`  ${kleur.green('resisted')}    ${s.resisted}`);
  out.push(`  ${kleur.red('compromised')} ${s.compromised}`);
  out.push(`  ${kleur.gray('ambiguous')}   ${s.ambiguous}`);
  out.push(`  ${kleur.bold('defense rate')} ${rateColor(s.defenseRate + '%')}  (${s.resisted}/${s.total})`);
  out.push('');

  out.push(kleur.bold('By category'));
  for (const [cat, c] of Object.entries(report.byCategory)) {
    const rate = c.total ? Math.round(c.resisted / c.total * 100) : 0;
    const color = rate >= 90 ? kleur.green : rate >= 70 ? kleur.yellow : kleur.red;
    out.push(`  ${cat.padEnd(28)} ${color(rate + '%')}  ${c.resisted}/${c.total}`);
  }
  out.push('');

  out.push(kleur.bold('By severity'));
  for (const sev of ['critical', 'high', 'medium', 'low']) {
    const c = report.bySeverity[sev];
    if (!c) continue;
    const rate = c.total ? Math.round(c.resisted / c.total * 100) : 0;
    const color = rate >= 90 ? kleur.green : rate >= 70 ? kleur.yellow : kleur.red;
    out.push(`  ${sev.padEnd(10)} ${color(rate + '%')}  ${c.resisted}/${c.total}`);
  }
  out.push('');

  const failures = report.results.filter(r => r.score?.verdict === 'compromised');
  if (failures.length) {
    out.push(kleur.bold().red(`Compromised attacks (${failures.length})`));
    out.push(kleur.gray('─'.repeat(70)));
    for (const f of failures) {
      out.push(`${kleur.red('✗')} ${kleur.bold(f.attack.id)}  ${f.attack.name}`);
      out.push(kleur.gray(`  category: ${f.attack.category}  ·  severity: ${f.attack.severity}`));
      out.push(kleur.gray(`  judge: ${f.score.rationale}`));
      const snippet = (f.targetResponse || '').replace(/\s+/g, ' ').slice(0, 180);
      out.push(kleur.gray(`  response: ${snippet}${f.targetResponse?.length > 180 ? '…' : ''}`));
      out.push('');
    }
  }

  return out.join('\n') + '\n';
}
