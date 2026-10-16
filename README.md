# PROOFLOOP

**Every fix must prove itself.**

PROOFLOOP is an evidence-first autonomous software verification MVP for the Agents & Automation track. It demonstrates how a verification agent can independently reproduce a defect, apply a proposed repair in an isolated workspace, execute the original and regression tests, and issue a verdict from observed results rather than from a repair claim.

## What is implemented

- A responsive local dashboard with verification history and inspectable evidence.
- A deliberately broken calculator scenario: `20% off 250` incorrectly returns `230` instead of `200`.
- A baseline run that executes the real allowlisted command `node test-original.js` and records output, exit code, duration, and status.
- A deterministic good repair applied only to a temporary copy, followed by the original test and regression tests.
- A mandatory bad-fix challenge: the attempted fix satisfies the headline case but fails regression checks, so PROOFLOOP rejects it.
- Local JSON evidence persistence in `data/runs.json` (ignored from Git because it is runtime state).
- A SHA-256 digest for every stored record, plus downloadable JSON and HTML reports. The digest detects later record changes; it does not prove the software is bug-free.
- Search and verdict filters, a side-by-side comparison view, a verification timeline, patch inspection, and explicit `NOT RUN` comparison cards.
- A deliberate execution-error fixture that produces `ERROR`, never `PASS`.
- Explicit `PASS`, `FAIL`, and `ERROR` verdict logic. Timeouts and execution errors cannot become `PASS`.
- A reset action that clears the evidence ledger and makes the demonstration repeatable.

The MVP does not call a generative model or claim automatic bug-fix generation. The included repairs are deterministic fixtures so judges can inspect and repeat the verification mechanism without credentials or network access.

## Run locally

Requirements: Node.js 22 (or Node 20+). The dependency tree is empty; `package-lock.json` is committed for reproducible npm tooling.

```bash
npm test
npm start
```

Open <http://localhost:4173>. The exact one-command test entry point is `npm test`. For a terminal demonstration of all four outcomes:

```bash
npm run smoke
# {"baseline":"FAIL","good":"PASS","bad":"FAIL","error":"ERROR","digested":true}
```

## Judge walkthrough

1. Open the dashboard and click **Run baseline**. The original test fails against the real broken calculator implementation.
2. Select the new ledger entry and inspect the command, expected/actual result, exit code evidence, and assertion output.
3. Click **Verify good repair**. PROOFLOOP copies the scenario to a temporary workspace, applies the good patch, and runs both the original and regression checks. The verdict is `PASS` only when both pass.
4. Click **Challenge bad fix**. The bad patch makes the headline test pass but regression checks fail; the overall verdict remains `FAIL`.
5. Use the evidence filters, open a run, inspect its timeline and diff, and download JSON or HTML evidence.
6. The comparison section shows `NOT RUN` until each scenario has a real stored record.
7. Use **Reset demo** to clear the local ledger and repeat the flow.
8. The execution-error fixture is available through `POST /api/verify/error` and is displayed as `ERROR`; timeout behavior is covered by the automated boundary test.

## Architecture

- `index.html`, `styles.css`, `app.js`: dashboard UI and evidence inspection.
- `server.js`: dependency-free HTTP server and JSON API.
- `lib/engine.js`: scenario copying, allowlisted test execution, repair application, verdict calculation, SHA-256 evidence digests, timeline generation, and persistence.
- `scenarios/calculator`: source defect, deterministic tests, good/bad repair fixtures, plus execution-error and timeout fixtures.
- `test/engine.test.js`: behavior tests for reproduction, successful repair, bad-fix rejection, error verdicts, digest integrity, allowlist rejection, persistence, and reset.

The engine only executes five fixed test files with Node (including error, timeout, and output-limit fixtures), uses a five-second timeout, and runs repairs in a temporary copied workspace. It records the patch identifier and changed file rather than accepting arbitrary dashboard code. This is a local demonstration boundary, not a general sandbox for untrusted repositories. API bodies are bounded and repair values are allowlisted; arbitrary browser-supplied commands and paths are rejected.

## Verdicts

- **PASS** — every required verification test completed with exit code 0.
- **FAIL** — required tests completed but at least one failed.
- **ERROR** — verification could not complete reliably, such as a timeout or runner error.

PROOFLOOP establishes evidence against this defined test set and execution boundary; it does not guarantee bug-free software.

## Docker

```bash
docker build -t proofloop .
docker run --rm -p 4173:4173 proofloop
```

The server honors the `PORT` and `HOST` environment variables. Local runs bind to `127.0.0.1` by default; the Docker image sets `HOST=0.0.0.0` so the container port is reachable. The optional `PROOFLOOP_DATA_FILE` variable selects a ledger path for isolated test/deployment storage. For a live deployment, use a container host that supports a persistent writable volume mounted at `/app/data`; the evidence ledger is local JSON state and will otherwise be lost when an ephemeral instance is replaced. A small persistent-disk service on Render, Fly.io, Railway, or an equivalent container host is a suitable deployment shape. This repository does not include provider-specific credentials, deployment configuration, or a claimed live URL.

## Known limitations

This buildathon MVP verifies the included calculator scenario and deterministic repair fixtures. It does not yet ingest arbitrary repositories, generate patches with an AI model, or provide a production-grade container sandbox/resource quota system. A public repository shell exists at `https://github.com/njcryptx/PROOFLOOP`, but the local project commits are not yet pushed from this environment. No live deployment is claimed.
