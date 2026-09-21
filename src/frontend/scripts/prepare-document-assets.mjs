import { copyFileSync, cpSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import ts from 'typescript';
import { Script } from 'node:vm';
const target = new URL('../public/document-engine/', import.meta.url);
mkdirSync(target, { recursive: true });
const modules = new URL('../node_modules/', import.meta.url);
copyFileSync(new URL('tesseract.js/dist/worker.min.js', modules), new URL('worker.min.js', target));
for (const file of readdirSync(new URL('tesseract.js-core/', modules)).filter(name => /-lstm\.wasm(?:\.js)?$/.test(name))) {
  copyFileSync(new URL('tesseract.js-core/' + file, modules), new URL(file, target));
}
copyFileSync(new URL('@tesseract.js-data/eng/4.0.0/eng.traineddata.gz', modules), new URL('eng.traineddata.gz', target));
// The worker cannot import from the app, so the Map upsert polyfill is
// prepended to it from the same single source the page imports. pdf.js calls
// those methods inside the worker too, and a browser that lacks them fails
// there first. See src/lib/mapUpsert.ts.
const upsertPolyfill = ts.transpileModule(
  readFileSync(new URL('../src/lib/mapUpsert.ts', import.meta.url), 'utf8'),
  { compilerOptions: { target: ts.ScriptTarget.ES2023 } },
).outputText;
// Parse what we are about to prepend. A transpile that quietly did not happen
// leaves TypeScript annotations in a worker pdf.js then cannot load, and the
// only symptom is a fallback to its fake worker much later, in a browser.
new Script(upsertPolyfill);
const pdfWorker = readFileSync(new URL('pdfjs-dist/build/pdf.worker.min.mjs', modules), 'utf8');
writeFileSync(new URL('pdf.worker.min.mjs', target), `${upsertPolyfill}\n${pdfWorker}`);

for (const folder of ['standard_fonts', 'wasm', 'cmaps', 'iccs']) {
  cpSync(new URL('pdfjs-dist/' + folder + '/', modules), new URL(folder + '/', target), { recursive: true });
}
