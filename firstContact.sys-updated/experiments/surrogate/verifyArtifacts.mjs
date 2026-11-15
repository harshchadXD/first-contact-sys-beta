import fs from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';

const read = path => fs.readFileSync(new URL(path, import.meta.url));
const json = path => JSON.parse(read(path));
const sha = value => createHash('sha256').update(value).digest('hex');
const manifest = json('./label-manifest.json');
// Study identity uses JSON.stringify(parsed study), independent of file whitespace.
assert.equal(manifest.sourceStudySha256, sha(JSON.stringify(json('../../frontend/src/data/shackletonStudy.json'))));
assert.equal(manifest.wasmSha256, sha(read('../../engine/pkg/first_contact_engine_bg.wasm')));
const labels = JSON.parse(gunzipSync(read('./labels.json.gz')));
assert.deepEqual(labels.metadata, manifest);
assert.equal(labels.rows.length, manifest.cases);
const report = json('./evaluation.json');
assert.deepEqual(report.sourceManifest, manifest);
assert.equal(report.totalLabelledCases, manifest.cases);
assert.equal(json('./model.json').trainingSeed, report.seed);
const notebook = json('./experiment.ipynb');
assert.equal(notebook.nbformat, 4);
assert.ok(notebook.cells.filter(cell => cell.cell_type === 'code').every(cell => cell.execution_count === null));
console.log('Saved labels, study/WASM hashes, model report and notebook provenance PASS');
