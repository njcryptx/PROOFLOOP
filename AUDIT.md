# PROOFLOOP quality, security, and release audit

- **Audit date:** 2026-10-17 (Asia/Kolkata)
- **Audited commit:** `b3424c6`
- **Repository:** local `/c/PROOFLOOP`
- **Scope:** local application, deterministic fixtures, HTTP API, evidence ledger, dashboard assets, tests, Dockerfile, and release documentation

## Status summary

| Area | Status | Evidence |
|---|---|---|
| Repository health | PASS | Clean Git tree; Node 22.23.3; npm 10.9.9; `.nvmrc`; lockfile |
| Unit and integration tests | PASS | `npm test`: 16 tests passed |
| Four demo outcomes | PASS | Smoke: `FAIL / PASS / FAIL / ERROR` |
| API validation | PASS | Invalid JSON 400; invalid repair 400; oversized body 413 |
| Concurrent persistence | PASS | 8 concurrent baseline requests retained 8 unique records |
| Restart persistence | PASS | HTTP integration test stopped/restarted server and read retained records |
| Evidence integrity | PASS | SHA-256 mismatch is rejected on read; exports match source records |
| Execution boundary | PASS with limitations | Allowlisted `execFile`, timeout, output cap, temporary copy, cleanup tests |
| Static-file exposure | PASS | Public asset allowlist; source paths return 404 |
| Security headers | PASS | CSP, `nosniff`, frame denial, referrer policy tested |
| Dependency audit | PASS | `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities |
| Browser rendering | PASS | Built-in browser loaded dashboard at narrow responsive viewport |
| Browser click automation | BLOCKED | Browser dispatch was unavailable in this session; API integration covers actions |
| Accessibility static checks | PASS | Title, landmarks, named controls, focus styles, mobile media, reduced-motion CSS |
| Full WCAG 2.2 AA audit | BLOCKED | No automated axe scan or assistive-technology session available |
| Docker build/runtime | BLOCKED | Docker CLI/runtime unavailable in the environment |
| GitHub publication | BLOCKED | No remote configured; GitHub CLI unavailable/auth not configured |
| Live deployment | BLOCKED | Requires approved provider, credentials, and persistent storage |

## Commands executed

```bash
npm test
npm run smoke
npm install --package-lock-only --ignore-scripts --no-audit
npm audit --omit=dev --audit-level=high
git diff --check
git status --short
git log --oneline -5
```

HTTP integration tests start the real server on an ephemeral local port and exercise:

- Dashboard and public asset routes
- Favicon and missing-file behavior
- Source-file exposure rejection
- Security headers
- Baseline, good repair, bad repair, and execution-error routes
- Search and verdict filters
- JSON and HTML report exports
- Invalid JSON and repair identifiers
- Oversized request bodies
- Concurrent ledger writes
- Server restart persistence
- Reset repetition
- Malformed persisted evidence

## New tests and fixtures

- `test/http.test.js` — real HTTP/API integration coverage.
- Concurrent ledger-write test.
- Server restart persistence test.
- Public asset allowlist test.
- Security-header test.
- Request validation and oversized-body tests.
- `scenarios/calculator/test-output.js` — output-limit execution fixture.
- Output-limit failures are classified as `ERROR`.
- Ledger writes are serialized and use unique temporary filenames.
- Verification cleanup runs in `finally` so failed execution does not leave the temporary workspace behind.

## Findings and fixes

### High-value reliability findings — fixed

1. **Concurrent ledger writes could race.** Fixed with a serialized ledger lock and unique temporary filenames. Covered by concurrent HTTP integration tests.
2. **Failed verification could skip temporary-workspace cleanup.** Fixed with `try/finally`. Original scenario preservation remains tested.
3. **No lockfile prevented npm audit.** Added `package-lock.json`; audit now reports zero vulnerabilities.
4. **Local server default could bind beyond localhost.** Local default is now `127.0.0.1`; Docker explicitly sets `HOST=0.0.0.0` for container reachability.
5. **Source files were statically readable.** Static serving is restricted to `index.html`, `styles.css`, and `app.js`.
6. **External font import weakened offline behavior and CSP.** Removed the network font import; system fallbacks remain available.
7. **Oversized child-process output was not explicitly treated as infrastructure failure.** Output-limit errors now become `ERROR`.

### Remaining security and product limitations

- The app has no authentication or authorization. It is suitable for local/demo use, not direct public exposure without an access-control layer.
- A temporary directory is not a production sandbox. There is no container isolation, network isolation, separate user, seccomp/AppArmor policy, or resource quota beyond timeout and output limits.
- The SHA-256 digest detects record changes when read, but is not signed, append-only, or resistant to an attacker who can rewrite both the record and digest.
- Reset is a destructive local state action and has no authentication or confirmation at the API layer. The dashboard does request confirmation.
- Malformed evidence is rejected with HTTP 500 and requires reset/recovery; the application does not quarantine corrupted ledgers.
- No arbitrary repository import or AI-generated repair capability is implemented.

## Browser and accessibility notes

The built-in browser loaded the page and exposed the expected dashboard controls, overview cards, evidence rows, comparison cards, and empty/filled states at a narrow viewport. Static checks confirmed semantic title/main/nav structure, named search/filter controls, keyboard-focusable evidence rows, visible `:focus-visible` styling, responsive media rules, and reduced-motion handling.

A browser action dispatch could not be completed through the available browser control surface, so click-by-click interaction is not claimed as browser-automated. The same actions are covered through the real HTTP integration suite. No browser console reader or automated WCAG scanner was available.

## Release decision

**READY FOR LOCAL DEMONSTRATION.** The critical deterministic workflow and its failure modes are tested and reproducible.

**NOT READY FOR PUBLIC RELEASE yet.** GitHub publication, live deployment, and buildathon portal submission remain external steps requiring the owner's account approval and credentials. A live deployment must use persistent storage and an access-control boundary before public exposure.
