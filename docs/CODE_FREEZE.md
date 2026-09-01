# CountryLab code-freeze candidate

This source tree is the freeze candidate produced after the final local technical hardening pass.

## Freeze changes

- WebMCP capability detection now requires `document.modelContext.registerTool` to be callable.
- Counterfactual cancellation signals are propagated into deterministic replay/comparison work.
- Stale/different snapshot lineage produces an explicit error instead of silently omitting later actions.
- Prove It displays counterfactual errors through an accessible alert.
- Phaser map exposes a dynamic screen-reader summary.
- All CSS text below 10px was raised to 10px; identified weak secondary-text colors were brightened.
- `*.tsbuildinfo` is ignored and generated build-info files were removed.
- Package metadata now includes description, Node >=22.12 requirement and `npm run typecheck`.
- Submission/status/model/assets/docs were refreshed to match the implementation.
- `inspect_sector` now exposes the existing `central_bank` sector as part of the semantic model.
- The developer inspector uses the same callable WebMCP capability check as production registration.
- Phaser micro-labels below 10px were raised to 10px to match the React readability pass.
- `npm run verify` provides a single final test + production-build gate on a normal machine.

## Local validation

- 53/53 automated source-logic tests passed (35/35 dependency-free without any package shim) using a temporary local Zustand-compatible test shim because the audit environment cannot download the locked Zustand package.
- Strict TypeScript project checking passed with temporary external-package declaration stubs; no source type error was found in the freeze changes.
- Static road centerlines were spot-checked against the actual bundled map artwork and follow the authored roads/bridges; runtime animation still requires the external rendered QA checklist.
- No temporary `node_modules`, build output, or TypeScript build-info files are retained in the freeze tree.
- Presentation histories (metrics, causal records, events/logs) are bounded. The internal `actionHistory` is intentionally retained as an exact replay ledger because truncating it can invalidate old counterfactual checkpoints; stale/different lineage now fails explicitly instead of producing a wrong experiment.

## Required freeze gate on a normal machine

```bash
rm -rf node_modules dist .vite
npm ci
npm run typecheck
npm test
npm run build
```

Then run `docs/FINAL_WEBMCP_QA.md` against the exact deployed commit. If all gates pass, do not change source except to fix a demonstrated blocking defect.
