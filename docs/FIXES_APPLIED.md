# Hackathon-readiness fixes applied

This document records correctness and freeze-hardening work already present in the authoritative source.

1. **Event counterfactuals use event-time checkpoints.** `run_counterfactual` resolves flood/drought/etc. experiments to the saved event checkpoint unless an explicit valid snapshot is supplied.
2. **Later live interventions are replayed.** Structured policy/event/time actions after the checkpoint are replayed at their original points in both branches, preserving “same timeline except this event.”
3. **Stale lineage fails explicitly.** A snapshot that is not a prefix of the current live action history now produces a clear error rather than silently replaying zero later actions.
4. **Event IDs are normalized.** Read tools expose reusable `eventId` values such as `event-1`; causal-root inputs such as `event:event-1` are normalized on input.
5. **Unknown events fail explicitly.** Invalid event IDs cannot silently produce a zero-effect comparison.
6. **Preset scenarios preserve checkpoints.** Demo scenarios capture the country immediately after each event, before later consequences/policies accumulate.
7. **Tool schemas match engine constraints.** Policy bounds and event-region pairings are encoded in JSON Schema; counterfactual policy bounds are equally strict.
8. **Read-only classification corrected.** Observation tools and `compare_scenarios` carry `readOnlyHint`; visible-state and economic-state mutations do not.
9. **Agent-facing vocabulary normalized.** WebMCP returns `trade_conflict`; the engine's internal `war` identifier does not leak through the public contract.
10. **Registration lifecycle hardened.** Capability detection checks `document.modelContext?.registerTool`, registration is idempotent, cleanup uses an AbortController, and failed registration can retry.
11. **Execution cancellation is propagated.** The WebMCP execution signal now reaches counterfactual/replay code and is checked at deterministic work boundaries.
12. **UI experiment errors are visible.** Prove It displays lineage/counterfactual failures in an accessible alert instead of failing silently.
13. **Accessibility/readability pass completed.** Sub-10px CSS text was raised to 10px, previously weak secondary text colors were brightened, and the Phaser map has a dynamic screen-reader summary.
14. **Build hygiene improved.** `*.tsbuildinfo` is ignored and generated build-info files were removed.
15. **Package metadata hardened.** The project declares its MIT license, Node >=22.12 runtime requirement, description, and a dedicated `typecheck` script.

## Final offline validation

- **53/53 source-logic automated tests passed.**
- Regression coverage includes deterministic replay, event checkpointing, live-state isolation, normalized event IDs, schema bounds, read-only classification, unsupported/partial WebMCP capability detection, registration retry/idempotency/cleanup, counterfactual cancellation, and stale lineage rejection.
- The complete test run used a temporary local Zustand-compatible shim only because this audit environment could not download the locked Zustand package; it was removed after the run.
- `npm ci --offline` was also attempted and failed only because `zustand@5.0.15` is absent from the local npm cache.

The remaining checks are environment/submission checks, not feature work: clean networked install/typecheck/build, Chrome 149+/ChatGPT WebMCP QA, rendered traffic/responsive QA, judge-access verification, and final public repository/video/Devpost materials.
