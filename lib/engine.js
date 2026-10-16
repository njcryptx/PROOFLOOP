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
const ALLOWED_TESTS = {
  original: 'test-original.js',
  regression: 'test-regression.js'
};

async function readRuns() {
  try { return JSON.parse(await fs.readFile(DATA, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}
async function writeRuns(runs) {
  await fs.mkdir(path.dirname(DATA), { recursive: true });
  await fs.writeFile(DATA, JSON.stringify(runs, null, 2) + '\n');
}
function statusFrom(result) { return result.exitCode === 0 ? 'PASS' : result.timedOut ? 'ERROR' : 'FAIL'; }
async function runAllowedTest(cwd, testId) {
  const file = ALLOWED_TESTS[testId];
  if (!file) throw new Error('Test is not allowlisted');
  const started = Date.now();
  try {
    const out = await execFileAsync(process.execPath, [file], { cwd, timeout: 5000, maxBuffer: 1024 * 128 });
    return { testId, command: `node ${file}`, expected: 'exit code 0', actual: 'exit code 0', exitCode: 0, status: 'PASS', stdout: out.stdout, stderr: out.stderr, durationMs: Date.now() - started };
  } catch (error) {
    const timedOut = error.killed || error.signal === 'SIGTERM';
    return { testId, command: `node ${file}`, expected: 'exit code 0', actual: timedOut ? 'execution timed out' : `exit code ${error.code ?? 'unknown'}`, exitCode: typeof error.code === 'number' ? error.code : null, status: timedOut ? 'ERROR' : 'FAIL', stdout: error.stdout || '', stderr: error.stderr || error.message, durationMs: Date.now() - started, timedOut };
  }
}
async function copyScenario() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'proofloop-'));
  await fs.cp(SCENARIO, dir, { recursive: true });
  return dir;
}
async function applyRepair(dir, kind) {
  if (!['good', 'bad'].includes(kind)) throw new Error('Unknown repair');
  const source = await fs.readFile(path.join(SCENARIO, 'repairs', kind, 'app.js'), 'utf8');
  await fs.writeFile(path.join(dir, 'app.js'), source);
  return { kind, patchId: `calculator-${kind}-repair`, changedFiles: ['app.js'], diffSummary: kind === 'good' ? 'Replace subtraction with percentage calculation.' : 'Special-case the headline example; edge cases remain broken.' };
}
function overall(results) {
  if (results.some(x => x.status === 'ERROR')) return 'ERROR';
  return results.every(x => x.status === 'PASS') ? 'PASS' : 'FAIL';
}
async function createRun({ mode = 'baseline', repair = null } = {}) {
  const runId = `run-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const workspace = await copyScenario();
  const baseline = { original: await runAllowedTest(workspace, 'original') };
  let patch = null;
  let postRepair = {};
  let regressions = {};
  if (mode === 'repair') {
    patch = await applyRepair(workspace, repair);
    postRepair = { original: await runAllowedTest(workspace, 'original') };
    regressions = { regression: await runAllowedTest(workspace, 'regression') };
  }
  const required = mode === 'repair' ? [postRepair.original, regressions.regression] : [baseline.original];
  const verdict = overall(required);
  const record = { runId, timestamp: new Date().toISOString(), scenario: 'calculator-discount', mode, verdict, patch, baseline, postRepair, regressions, evidence: { isolatedWorkspace: true, allowlistedTests: Object.values(ALLOWED_TESTS), timeoutMs: 5000 } };
  const runs = await readRuns(); runs.unshift(record); await writeRuns(runs.slice(0, 50));
  await fs.rm(workspace, { recursive: true, force: true });
  return record;
}
async function reset() { await fs.rm(DATA, { force: true }); return { reset: true }; }
module.exports = { createRun, readRuns, reset, runAllowedTest, overall, SCENARIO };
