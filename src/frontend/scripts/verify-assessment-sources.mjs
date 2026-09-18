import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const root = new URL('../src/features/assessment/', import.meta.url);
const register = JSON.parse(readFileSync(new URL('source-register.json', root), 'utf8'));
const rules = readFileSync(new URL('phone.ts', root), 'utf8');
assert.deepEqual(register.sources.map(source => source.id).sort(), ['fixed', 'phone', 'records']);
for (const source of register.sources) {
  const snapshot = readFileSync(new URL(source.snapshot, root));
  assert.equal(createHash('sha256').update(snapshot).digest('hex'), source.sha256, `${source.id}: snapshot hash changed`);
  assert.ok(rules.includes(`${source.id}: '${source.sha256}'`), `${source.id}: rule binding changed`);
  assert.ok(source.url.startsWith('https://www.ato.gov.au/'));
  assert.ok(snapshot.toString().includes(source.title));
  assert.ok(snapshot.toString().includes('QC\n' + source.qc));
  assert.deepEqual(source.applicableYears, ['2025-26']);
  assert.equal(source.reviewStatus, 'pending');
  assert.equal(source.reviewedAt, null);
  assert.equal(source.reviewer, null);
}
console.log('Three ATO snapshots and draft rule bindings verified; qualified review remains pending.');
