import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const root = new URL('../src/features/tax-position/', import.meta.url);
const register = JSON.parse(readFileSync(new URL('source-register.json', root), 'utf8'));
const rules = readFileSync(new URL('sourceHealth.ts', root), 'utf8');
assert.deepEqual(register.sources.map(s => s.id).sort(), ['instructions', 'lito', 'medicare', 'mls', 'rates']);
for (const source of register.sources) {
  const snapshot = readFileSync(new URL(source.snapshot, root));
  assert.equal(createHash('sha256').update(snapshot).digest('hex'), source.sha256, `${source.id}: snapshot changed`);
  assert.ok(rules.includes(`"${source.id}": "${source.sha256}"`), `${source.id}: binding changed`);
  assert.ok(source.url.startsWith('https://www.ato.gov.au/'));
  assert.ok(snapshot.toString().includes(source.title));
  assert.ok(snapshot.toString().includes('QC\n' + source.qc));
  assert.deepEqual(source.applicableYears, ['2025-26']);
  assert.equal(source.reviewStatus, 'pending'); assert.equal(source.reviewer, null); assert.equal(source.reviewedAt, null);
}
console.log('Five ATO calculation snapshots verified. Tax/rounding approval remains pending.');
