const test = require('node:test');
const assert = require('node:assert/strict');
const { createRun, readRuns, reset, overall, digestEvidence, runAllowedTest, SCENARIO } = require('../lib/engine');
const fs = require('node:fs/promises');
const path = require('node:path');

test.beforeEach(async () => { await reset(); });
test('baseline records the reproducible defect as FAIL', async () => { const r=await createRun({mode:'baseline'}); assert.equal(r.verdict,'FAIL'); assert.equal(r.baseline.original.status,'FAIL'); assert.match(r.baseline.original.stderr,/20% off/); });
test('good repair passes original and regression tests', async () => { const r=await createRun({mode:'repair',repair:'good'}); assert.equal(r.verdict,'PASS'); assert.equal(r.postRepair.original.status,'PASS'); assert.equal(r.regressions.regression.status,'PASS'); assert.equal(r.patch.patchId,'calculator-good-repair'); });
test('bad repair is rejected by regression verification', async () => { const r=await createRun({mode:'repair',repair:'bad'}); assert.equal(r.postRepair.original.status,'PASS'); assert.equal(r.regressions.regression.status,'FAIL'); assert.equal(r.verdict,'FAIL'); });
test('errors never become PASS', () => { assert.equal(overall([{status:'ERROR'}]),'ERROR'); assert.equal(overall([{status:'PASS'},{status:'FAIL'}]),'FAIL'); });
test('evidence is persisted and resettable', async () => { await createRun({mode:'baseline'}); assert.equal((await readRuns()).length,1); await reset(); assert.equal((await readRuns()).length,0); });

test('execution-error fixture produces ERROR and a digest', async () => { const r=await createRun({mode:'error'}); assert.equal(r.verdict,'ERROR'); assert.equal(r.regressions.execution.status,'ERROR'); assert.equal(r.evidenceDigest,digestEvidence(r)); assert.equal(r.evidenceDigest.length,64); });
test('unknown tests are rejected by the allowlist', async () => { await assert.rejects(() => runAllowedTest(process.cwd(), 'shell'), /not allowlisted/); });

test('timeout is classified as ERROR by the execution boundary', async () => { const result = await runAllowedTest(SCENARIO, 'timeout'); assert.equal(result.status, 'ERROR'); assert.equal(result.timedOut, true); });
test('tampered persisted evidence is detected on read', async () => { await createRun({mode:'baseline'}); const file=path.join(__dirname, '..', 'data', 'runs.json'); const records=JSON.parse(await fs.readFile(file, 'utf8')); records[0].verdict='PASS'; await fs.writeFile(file, JSON.stringify(records)); await assert.rejects(() => readRuns(), /integrity check failed/); await reset(); });
test('repairs do not modify the original scenario file', async () => { const file=path.join(SCENARIO, 'app.js'); const before=await fs.readFile(file, 'utf8'); await createRun({mode:'repair',repair:'good'}); assert.equal(await fs.readFile(file, 'utf8'), before); });

test('output-limit failures are classified as ERROR', async () => { const result = await runAllowedTest(SCENARIO, 'output'); assert.equal(result.status, 'ERROR'); });
