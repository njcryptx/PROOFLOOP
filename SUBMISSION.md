# PROOFLOOP buildathon submission checklist

## Recommended track

**Agents & Automation**

PROOFLOOP demonstrates an autonomous verification workflow: it runs an allowlisted test command, applies a deterministic repair fixture in an isolated temporary copy, executes required checks, and produces a verdict from captured evidence.

## Verified submission description

PROOFLOOP is an evidence-first software verification platform built around a simple rule: a repair is not verified because someone says it works. The included calculator scenario contains a real percentage-discount defect. PROOFLOOP reproduces that defect with an actual failing test, records the command, exit code, duration, and output, then evaluates proposed changes in a temporary workspace.

The successful-repair path applies the known-good fixture and reruns the original test plus regression checks. The adversarial path applies a deliberately bad fixture that satisfies the headline example but fails regression coverage, so PROOFLOOP rejects it. A separate execution-error fixture demonstrates that an unreliable test run becomes `ERROR`, never `PASS`.

The dashboard provides a searchable evidence ledger, verdict filters, run comparison, timeline, patch inspection, downloadable JSON and HTML reports, resettable demo state, and SHA-256 digests for detecting later record changes. The digest is an integrity check for the stored record; it is not a signature and does not guarantee bug-free software.

The current MVP uses deterministic fixtures and does not claim generative model access, arbitrary repository ingestion, automatic AI patch generation, or production-grade sandboxing.

## Five-minute recording script

1. Start the application with `npm start` and open `http://localhost:4173`.
2. Briefly introduce the scenario: `20% off 250` incorrectly returns `230` in the defective sample.
3. Click **Reset demo** so the run begins from an empty evidence ledger.
4. Click **Run baseline** and open the record. Show the real failing assertion, command, exit code, duration, and captured stderr.
5. Click **Verify good repair**. Open the resulting `PASS` record and show the original test, regression test, isolated-workspace timeline, patch identifier, diff, and digest.
6. Click **Challenge bad fix**. Show that the headline test passes but the regression check fails and the overall verdict is `FAIL`.
7. Click **Run error path**. Show the explicit `ERROR` verdict and explain that execution failure is not converted into success.
8. Show the overview totals, verdict filters, comparison cards, and JSON/HTML report links.
9. End by stating the limitation: this local MVP verifies its included deterministic scenario and does not claim arbitrary untrusted-code sandboxing.

For a terminal-only proof of the four outcomes, run:

```bash
npm test
npm run smoke
```

Expected smoke summary:

```json
{"baseline":"FAIL","good":"PASS","bad":"FAIL","error":"ERROR","digested":true}
```

## Publication status

- GitHub repository URL: **https://github.com/njcryptx/PROOFLOOP** (public repository created; project commits still require authenticated push)
- Live deployment URL: **not yet deployed**
- Demo video URL: **not yet recorded**
- Qualifying OmniRush session/event submission details: **to be confirmed in the buildathon portal**

Do not replace these statuses with links until each external result has been completed and verified.
