const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');

let child;
let base;
let output = '';
const testLedger = path.join(require('node:os').tmpdir(), `proofloop-http-${process.pid}.json`);
function startServer() {
  output = '';
  return new Promise((resolve, reject) => {
    child = spawn(process.execPath, ['server.js'], { cwd: path.join(__dirname, '..'), env: { ...process.env, PORT: '0', HOST: '127.0.0.1', PROOFLOOP_DATA_FILE: testLedger } });
    const onData = (chunk) => {
      output += chunk.toString();
      const match = output.match(/http:\/\/(?:localhost|127\.0\.0\.1):(\d+)/);
      if (match) { child.stdout.off('data', onData); base = `http://127.0.0.1:${match[1]}`; resolve(); }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', (chunk) => { output += chunk.toString(); });
    child.once('error', reject);
    setTimeout(() => reject(new Error(`server did not start: ${output}`)), 3000).unref();
  });
}
async function stopServer() { if (!child) return; child.kill('SIGTERM'); await new Promise((resolve) => child.once('exit', resolve)); child = null; }
async function request(route, options = {}) { const response = await fetch(`${base}${route}`, options); const text = await response.text(); let data; try { data = JSON.parse(text); } catch { data = text; } return { response, data }; }
function jsonOptions(method, value) { return { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) }; }

test.before(async () => { await fs.rm(testLedger, { force: true }); await startServer(); });
test.after(async () => { await stopServer(); await fs.rm(testLedger, { force: true }); });
test.beforeEach(async () => { await request('/api/reset', { method: 'POST' }); });

test('serves the dashboard, security headers, and rejects source exposure', async () => {
  const page = await request('/');
  assert.equal(page.response.status, 200);
  assert.match(page.response.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal((await request('/favicon.ico')).response.status, 404);
  assert.equal((await request('/server.js')).response.status, 404);
  assert.equal((await request('/%2e%2e/server.js')).response.status, 404);
});

test('exercises API validation, all outcomes, filters, and exports', async () => {
  assert.equal((await request('/api/verify/repair', jsonOptions('POST', { repair: 'shell' }))).response.status, 400);
  assert.equal((await request('/api/verify/repair', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad' })).response.status, 400);
  const runs = [];
  for (const [route, payload] of [['/api/verify/baseline'], ['/api/verify/repair', { repair: 'good' }], ['/api/verify/repair', { repair: 'bad' }], ['/api/verify/error']]) {
    const result = await request(route, payload ? jsonOptions('POST', payload) : { method: 'POST' });
    assert.equal(result.response.status, 201);
    runs.push(result.data);
  }
  assert.deepEqual(runs.map((r) => r.verdict), ['FAIL', 'PASS', 'FAIL', 'ERROR']);
  assert.equal((await request('/api/runs?verdict=PASS')).data.length, 1);
  assert.equal((await request('/api/runs?q=calculator-discount')).data.length, 4);
  await stopServer();
  await startServer();
  assert.equal((await request('/api/runs')).data.length, 4);
  const report = await request(`/api/runs/${runs[1].runId}/report.json`);
  assert.equal(report.response.status, 200);
  assert.equal(report.data.evidenceDigest, runs[1].evidenceDigest);
  assert.equal((await request(`/api/runs/${runs[1].runId}/report.html`)).response.status, 200);
});

test('serializes concurrent ledger writes without losing records', async () => {
  const responses = await Promise.all(Array.from({ length: 8 }, () => request('/api/verify/baseline', { method: 'POST' })));
  assert.ok(responses.every((x) => x.response.status === 201));
  const stored = await request('/api/runs');
  assert.equal(stored.data.length, 8);
  assert.equal(new Set(stored.data.map((x) => x.runId)).size, 8);
});

test('oversized bodies are rejected and reset is repeatable', async () => {
  const oversized = await request('/api/verify/repair', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ repair: 'good', extra: 'x'.repeat(5000) }) });
  assert.equal(oversized.response.status, 413);
  assert.equal((await request('/api/reset', { method: 'POST' })).response.status, 200);
  assert.equal((await request('/api/runs')).data.length, 0);
  assert.equal((await request('/api/reset', { method: 'POST' })).response.status, 200);
});

 test('malformed persisted ledger is rejected rather than treated as empty', async () => {
  const ledger = testLedger;
  await fs.writeFile(ledger, '{"not":"an array"}');
  const response = await request('/api/runs');
  assert.equal(response.response.status, 500);
  await request('/api/reset', { method: 'POST' });
});
