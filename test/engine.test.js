const test = require('node:test');
const assert = require('node:assert/strict');
const { createRun, readRuns, reset, overall } = require('../lib/engine');

test.beforeEach(async () => { await reset(); });
test('baseline records the reproducible defect as FAIL', async () => { const r=await createRun({mode:'baseline'}); assert.equal(r.verdict,'FAIL'); assert.equal(r.baseline.original.status,'FAIL'); assert.match(r.baseline.original.stderr,/20% off/); });
test('good repair passes original and regression tests', async () => { const r=await createRun({mode:'repair',repair:'good'}); assert.equal(r.verdict,'PASS'); assert.equal(r.postRepair.original.status,'PASS'); assert.equal(r.regressions.regression.status,'PASS'); assert.equal(r.patch.patchId,'calculator-good-repair'); });
test('bad repair is rejected by regression verification', async () => { const r=await createRun({mode:'repair',repair:'bad'}); assert.equal(r.postRepair.original.status,'PASS'); assert.equal(r.regressions.regression.status,'FAIL'); assert.equal(r.verdict,'FAIL'); });
test('errors never become PASS', () => { assert.equal(overall([{status:'ERROR'}]),'ERROR'); assert.equal(overall([{status:'PASS'},{status:'FAIL'}]),'FAIL'); });
test('evidence is persisted and resettable', async () => { await createRun({mode:'baseline'}); assert.equal((await readRuns()).length,1); await reset(); assert.equal((await readRuns()).length,0); });
