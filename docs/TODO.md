# Code-freeze checklist

## Complete in source

- [x] Deterministic economy engine with bounded outcomes.
- [x] Structured causal contributor records and WHY inspector.
- [x] Metric history/charts and event timeline.
- [x] Prove It counterfactual engine with isolated branches.
- [x] Event-time checkpoints plus replay of later live interventions.
- [x] Reject stale snapshot lineage rather than silently dropping interventions.
- [x] Scenario presets and deterministic demo mode.
- [x] 17-tool semantic WebMCP surface with strict schemas and bounded execution logging.
- [x] `registerTool` capability detection, idempotency, cleanup, retry, and cancellation signal plumbing.
- [x] Human UI and WebMCP share the same store/application actions.
- [x] Readability/contrast pass for sub-10px UI text.
- [x] Screen-reader summary for the Phaser country map.
- [x] MIT license and build-artifact ignore rules.
- [x] 53 source-logic regression tests passing in the final offline audit.

## External P0 — complete before submission

- [ ] Run clean `npm ci && npm run typecheck && npm test && npm run build` with normal npm access.
- [ ] Run the full real-browser WebMCP QA in ChatGPT / Chrome 149+.
- [ ] Perform multi-minute rendered road/traffic QA.
- [ ] Verify desktop, tablet, mobile, keyboard, reduced motion, and 200% text zoom on the production build.
- [ ] Verify a non-owner judge can access the final HTTPS deployment.
- [ ] Verify the public repository contains this exact frozen source and visible `LICENSE`.
- [ ] Document bundled artwork provenance/rights.
- [ ] Record/publish the public <3-minute narrated YouTube demo.
- [ ] Finish Devpost description and testing instructions.

## Freeze rule

Do not add backend/auth, live economic data, multiplayer, 3D, procedural worlds, or additional economic systems before submission. Only fix defects found by the external P0 QA above.
