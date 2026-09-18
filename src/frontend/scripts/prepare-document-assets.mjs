import { copyFileSync, cpSync, mkdirSync, readdirSync } from 'node:fs';
const target = new URL('../public/document-engine/', import.meta.url);
mkdirSync(target, { recursive: true });
const modules = new URL('../node_modules/', import.meta.url);
copyFileSync(new URL('tesseract.js/dist/worker.min.js', modules), new URL('worker.min.js', target));
for (const file of readdirSync(new URL('tesseract.js-core/', modules)).filter(name => /-lstm\.wasm(?:\.js)?$/.test(name))) {
  copyFileSync(new URL('tesseract.js-core/' + file, modules), new URL(file, target));
}
copyFileSync(new URL('@tesseract.js-data/eng/4.0.0/eng.traineddata.gz', modules), new URL('eng.traineddata.gz', target));
copyFileSync(new URL('pdfjs-dist/build/pdf.worker.min.mjs', modules), new URL('pdf.worker.min.mjs', target));

for (const folder of ['standard_fonts', 'wasm', 'cmaps', 'iccs']) {
  cpSync(new URL('pdfjs-dist/' + folder + '/', modules), new URL(folder + '/', target), { recursive: true });
}
