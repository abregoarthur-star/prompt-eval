import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function loadCorpus(path) {
  const file = path
    ? resolve(process.cwd(), path)
    : resolve(__dirname, '../corpus/attacks.json');
  const raw = await readFile(file, 'utf8');
  return JSON.parse(raw);
}

export function filterCorpus(corpus, { categories, severities, ids } = {}) {
  return corpus.filter(a => {
    if (categories?.length && !categories.includes(a.category)) return false;
    if (severities?.length && !severities.includes(a.severity)) return false;
    if (ids?.length && !ids.includes(a.id)) return false;
    return true;
  });
}
