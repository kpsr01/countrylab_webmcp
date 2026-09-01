# CountryLab — WebMCP economics sandbox

CountryLab is a deterministic learning sandbox where a human and an AI agent can inspect and steer the same mini-country. The agent receives semantic economic state, investigates causal evidence, runs isolated counterfactuals, and can visibly show the explanation in the webpage.

> Core interaction: **human changes the world → agent observes → agent investigates WHY → agent experiments safely → webpage shows the proof**.

## Run

```bash
npm ci
npm run dev
```

Open `http://localhost:5173`.

CountryLab works normally in browsers without WebMCP. Tools register only when `document.modelContext?.registerTool` is available.

## Interface

The strategy-game interface is organized around the live country rather than around developer controls:

- the illustrated Lumenia map is the visual centerpiece;
- map districts expose stable simulation-backed IDs, selection, health, status, and active-event overlays;
- freight, shipping, factory, and power activity respond to derived simulation state;
- national telemetry opens the deterministic WHY inspector;
- shocks and policies share a compact command center; and
- the Prove It lab remains visibly separate from the live world.

For a quick visual QA pass, load the Flooded Port preset, click each district, advance six months, open Inflation, and run PROVE IT. Repeat once at a narrow/mobile viewport.

## Architecture

```text
Human UI ─┐
          ├── Zustand actions ── application service ── deterministic economy engine
WebMCP ───┘                                      │
                                                └── React + Phaser render
```

The WebMCP layer is a structured adapter. It does not contain economic formulas or duplicate simulation logic.

## Tool surface

There are 17 tools:

- Observation: `get_country_state`, `inspect_region`, `inspect_sector`, `get_metric_history`, `get_event_history`, `get_causal_history`
- Live actions: `change_policy`, `trigger_event`, `provide_emergency_response`, `advance_months`, `create_snapshot`
- Isolated experiments: `run_counterfactual`, `compare_scenarios`
- Event counterfactuals branch from saved event-time checkpoints and replay later live interventions at their original points in time, so comparisons can mean “same timeline except this event.”
- Agent-facing event IDs are normalized (`event-1`) and reusable directly across read and experiment tools.
- Visible explanation: `highlight_region`, `show_metric`, `show_causal_chain`, `show_scenario_comparison`

Observation tools are marked with `readOnlyHint: true`. Live actions are explicit in their descriptions. Counterfactuals branch from a snapshot and do not overwrite live economic state. Visual tools change UI focus only.

## Testing WebMCP

The implementation uses the current imperative API:

```ts
document.modelContext.registerTool(tool, { signal });
```

It uses `execute(inputObject, { signal })`, the official `webmcp-types@0.1.5` declarations, and `AbortController` cleanup. There is no `navigator.modelContext` or public `unregisterTool()` usage.

Current official references:

- [WebMCP specification](https://webmachinelearning.github.io/webmcp/)
- [Chrome Imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
- [webmcp-types](https://www.npmjs.com/package/webmcp-types)

For challenge testing, use ChatGPT's WebMCP-capable in-app browser or Chrome 149+ with `chrome://flags/#enable-webmcp-testing` enabled. CountryLab capability-detects WebMCP, so unsupported browsers continue to run the human UI normally.

## Local inspector

Use the development-only inspector:

```text
http://localhost:5173/?webmcp-debug=1
```

It reports browser capability, expected definitions, registered names from `document.modelContext.getTools()` when available, schemas, manual handler output, and recent execution logs. The inspector is not shown on normal URLs.

## Example agent workflows

### Explain a shock

```text
get_country_state
→ get_metric_history({ metric: "inflation", months: 12 })
→ get_causal_history({ metric: "inflation", months: 12 })
```

### Change live policy

```text
change_policy({ policy: "interest_rate", value: 7 })
→ advance_months({ months: 12 })
→ show_metric({ metric: "unemployment" })
```

### Prove a causal claim without changing the country

```text
get_causal_history({ metric: "inflation" })
→ run_counterfactual({ type: "remove_event", eventId, months: 12 })
→ compare_scenarios({ baselineScenarioId, counterfactualScenarioId })
→ show_scenario_comparison({ comparisonId })
```

A human can intervene manually between any calls. Subsequent reads see the same live state and WebMCP mutations immediately update the visible UI. Agent-facing event terminology is normalized (`trade_conflict` rather than the engine's internal `war` label).

## Verification

```bash
npm run typecheck
npm test
npm run build
# or: npm run verify
```

Natural-language evaluation prompts and forbidden-tool expectations are in [`docs/WEBMCP_EVALS.md`](docs/WEBMCP_EVALS.md). The full tool contract and limitations are in [`docs/WEBMCP_TOOLS.md`](docs/WEBMCP_TOOLS.md).


## Final submission QA

Before submitting, run the real WebMCP browser-agent sequence in `docs/FINAL_WEBMCP_QA.md`. Automated tests validate tool semantics and counterfactual correctness, but browser-level discovery/permission UX must be checked in the actual WebMCP-capable surface.


## License

MIT — see [`LICENSE`](LICENSE).
