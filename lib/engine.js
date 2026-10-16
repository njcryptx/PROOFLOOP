const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const crypto = require('node:crypto');
const execFileAsync = promisify(execFile);

const ROOT = path.resolve(__dirname, '..');
const SCENARIO = path.join(ROOT, 'scenarios', 'calculator');
const DATA = path.join(ROOT, 'data', 'runs.json');
const ALLOWED_TESTS = Object.freeze({
  original: 'test-original.js',
  regression: 'test-regression.js',
  error: 'test-error.js',
  timeout: 'test-timeout.js'
});
const REPAIRS = new Set(['good', 'bad']);

async function readRuns() {
  try {
    const parsed = JSON.parse(await fs.readFile(DATA, 'utf8'));
    if (!Array.isArray(parsed)) throw new Error('Evidence ledger must contain an array');
    for (const record of parsed) {
      if (!record || typeof record !== 'object' || !record.evidenceDigest || !verifyEvidence(record)) throw new Error('Evidence ledger integrity check failed');
    }
    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw new Error(`Evidence ledger is unreadable: ${error.message}`);
  }
}
async function writeRuns(runs) {
  await fs.mkdir(path.dirname(DATA), { recursive: true });
  const temp = `${DATA}.tmp-${process.pid}`;
  await fs.writeFile(temp, JSON.stringify(runs, null, 2) + '\n');
  await fs.rename(temp, DATA);
}
function digestEvidence(record) {
  const copy = JSON.parse(JSON.stringify(record));
  delete copy.evidenceDigest;
  return crypto.createHash('sha256').update(JSON.stringify(copy)).digest('hex');
}
function verifyEvidence(record) { return typeof record?.evidenceDigest === 'string' && digestEvidence(record) === record.evidenceDigest; }
function overall(results) {
  if (results.some((x) => x.status === 'ERROR')) return 'ERROR';
  if (!results.length || results.some((x) => x.status !== 'PASS')) return 'FAIL';
  return 'PASS';
}
async function runAllowedTest(cwd, testId) {
  const file = ALLOWED_TESTS[testId];
  if (!file) throw new Error('Test is not allowlisted');
  const started = Date.now();
  try {
    const out = await execFileAsync(process.execPath, [file], { cwd, timeout: 5000, maxBuffer: 1024 * 128 });
    return { testId, command: `node ${file}`, expected: 'exit code 0', actual: 'exit code 0', exitCode: 0, status: testId === 'error' ? 'ERROR' : 'PASS', stdout: out.stdout, stderr: out.stderr, durationMs: Date.now() - started };
  } catch (error) {
    const timedOut = error.killed || error.signal === 'SIGTERM';
    const executionError = testId === 'error' || timedOut;
    return { testId, command: `node ${file}`, expected: 'exit code 0', actual: timedOut ? 'execution timed out' : `exit code ${error.code ?? 'unknown'}`, exitCode: typeof error.code === 'number' ? error.code : null, status: executionError ? 'ERROR' : 'FAIL', stdout: error.stdout || '', stderr: error.stderr || error.message, durationMs: Date.now() - started, timedOut: Boolean(timedOut) };
  }
}
async function copyScenario() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'proofloop-'));
  await fs.cp(SCENARIO, dir, { recursive: true });
  return dir;
}
async function applyRepair(dir, kind) {
  if (!REPAIRS.has(kind)) throw new Error('Unknown repair');
  const source = await fs.readFile(path.join(SCENARIO, 'repairs', kind, 'app.js'), 'utf8');
  const original = await fs.readFile(path.join(dir, 'app.js'), 'utf8');
  await fs.writeFile(path.join(dir, 'app.js'), source);
  return { kind, patchId: `calculator-${kind}-repair`, changedFiles: ['app.js'], diff: `--- a/app.js\n+++ b/app.js\n-${original.trim()}\n+${source.trim()}`, diffSummary: kind === 'good' ? 'Replace subtraction with a percentage calculation.' : 'Special-case the headline example; edge cases remain broken.' };
}
async function saveRecord(record) {
  record.evidenceDigest = digestEvidence(record);
  const runs = await readRuns();
  runs.unshift(record);
  await writeRuns(runs.slice(0, 100));
  return record;
}
async function createRun({ mode = 'baseline', repair = null } = {}) {
  if (!['baseline', 'repair', 'error'].includes(mode)) throw new Error('Unknown verification mode');
  if (mode === 'repair' && !REPAIRS.has(repair)) throw new Error('Repair must be good or bad');
  const runId = `run-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const workspace = await copyScenario();
  const timeline = [{ stage: 'workspace', label: 'Isolated workspace created', status: 'PASS' }];
  const baseline = { original: await runAllowedTest(workspace, 'original') };
  timeline.push({ stage: 'baseline', label: 'Baseline defect reproduction', status: baseline.original.status, testId: 'original' });
  let patch = null; let postRepair = {}; let regressions = {};
  if (mode === 'repair') {
    patch = await applyRepair(workspace, repair);
    timeline.push({ stage: 'patch', label: `${repair === 'good' ? 'Good' : 'Bad'} repair applied in isolation`, status: 'PASS' });
    postRepair = { original: await runAllowedTest(workspace, 'original') };
    timeline.push({ stage: 'post-repair', label: 'Original test after repair', status: postRepair.original.status, testId: 'original' });
    regressions = { regression: await runAllowedTest(workspace, 'regression') };
    timeline.push({ stage: 'regression', label: 'Regression checks', status: regressions.regression.status, testId: 'regression' });
  }
  if (mode === 'error') {
    regressions = { execution: await runAllowedTest(workspace, 'error') };
    timeline.push({ stage: 'error', label: 'Execution error fixture', status: regressions.execution.status, testId: 'error' });
  }
  const required = mode === 'repair' ? [postRepair.original, regressions.regression] : mode === 'error' ? [regressions.execution] : [baseline.original];
  const record = { runId, timestamp: new Date().toISOString(), scenario: 'calculator-discount', mode, verdict: overall(required), patch, baseline, postRepair, regressions, timeline, evidence: { isolatedWorkspace: true, allowlistedTests: Object.values(ALLOWED_TESTS), timeoutMs: 5000, engine: 'node child_process.execFile' } };
  await fs.rm(workspace, { recursive: true, force: true });
  return saveRecord(record);
}
async function reset() { await fs.rm(DATA, { force: true }); return { reset: true }; }
module.exports = { createRun, readRuns, reset, runAllowedTest, overall, digestEvidence, verifyEvidence, ALLOWED_TESTS, SCENARIO };
