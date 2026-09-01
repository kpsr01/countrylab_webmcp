# CountryLab WebMCP

CountryLab exposes a small semantic interface over the same application state used by React and Phaser. Tools do not contain economy formulas. They call the application service and Zustand actions already used by the human UI.

## Current API

Registration uses the current imperative API:

```ts
document.modelContext.registerTool(tool, { signal });
```

Handlers receive `(inputObject, { signal })` and return JSON-serializable values. Registration cleanup uses `AbortController.abort()`; there is no public `unregisterTool()` in the current API.

Primary references:

- [WebMCP specification](https://webmachinelearning.github.io/webmcp/)
- [Chrome Imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
- [webmcp-types 0.1.5](https://www.npmjs.com/package/webmcp-types)

The specification is a Community Group Draft, not a W3C Standard. Chrome availability is experimental and may require the WebMCP origin trial or `chrome://flags/#enable-webmcp-testing`. HTTPS, origin isolation, and the `tools` Permissions Policy apply.

## Tool table

### Safe observation

| Tool | Input | Purpose |
| --- | --- | --- |
| `get_country_state` | none | Concise current month, metrics, policies, active events, and warnings. |
| `inspect_region` | `region` | Health, damage, production, capacity, metrics, sectors, and recent events. |
| `inspect_sector` | `sector` | Output, health, capacity, and causal roots. |
| `get_metric_history` | `metric`, optional `months` | Bounded month/value history. |
| `get_event_history` | none | Major shocks and policy decisions in the live timeline. |
| `get_causal_history` | `metric`, optional `months` | WHY evidence and human-readable causal chains. |

These tools have `readOnlyHint: true` and do not mutate the live country.

### Explicit live mutations

| Tool | Input | Effect |
| --- | --- | --- |
| `change_policy` | `policy`, `value` | Changes one live policy. |
| `trigger_event` | `event`, optional canonical `region`, optional `severity` | Adds one supported live shock. If region is omitted CountryLab infers the only modeled valid region; if provided, the schema requires the valid event-region pair. |
| `provide_emergency_response` | `spending` | Changes the modeled emergency-spending lever in the live country. |
| `advance_months` | `months` 1–24 | Advances the live deterministic simulation. |
| `create_snapshot` | optional `label` | Adds a saved snapshot of the current live state. |

These tools are intentionally explicit in their descriptions because they change user-visible state.

### Isolated experiments

| Tool | Input | Effect |
| --- | --- | --- |
| `run_counterfactual` | intervention, `months` 1–36, optional snapshot | Creates an alternate branch and leaves live economic state unchanged. Event interventions automatically use the saved event-time checkpoint unless an explicit valid snapshot is supplied, then replay later live interventions at their original points within the requested horizon. |
| `compare_scenarios` | returned baseline/counterfactual scenario IDs | Read-only. Reads an existing comparison without changing live or UI state. |

Counterfactuals can remove an event, change policy, or change event severity. They create visible alternate-world comparison state but do not overwrite live metrics/history.

### Visible explanation

| Tool | Input | Effect |
| --- | --- | --- |
| `highlight_region` | `region` | Selects/highlights the region in the map and inspector. |
| `show_metric` | `metric` | Selects the dashboard metric. |
| `show_causal_chain` | `metric` | Opens the visible WHY explanation. |
| `show_scenario_comparison` | `comparisonId` | Opens an existing Prove It comparison. |

Visual tools change UI focus only. They do not mutate economic state and are not marked as read-only because they do change application-visible state.

## Debug inspector

Run the development server and add `?webmcp-debug=1`:

```text
http://localhost:5173/?webmcp-debug=1
```

The inspector shows capability status, the expected tool definitions, browser-discovered registrations when `getTools()` is available, schemas, manual handler execution, structured output, and a bounded execution log. The manual runner calls the exact same handlers used by WebMCP.

## Human + agent workflows

1. Human triggers Flooded Port.
2. Agent calls `get_country_state`, `get_metric_history`, and `get_causal_history`.
3. Agent calls `run_counterfactual` with `remove_event`.
4. Agent calls `compare_scenarios`.
5. Agent calls `show_scenario_comparison`.
6. Human sees the alternate-world proof and can return to the live country.

A human can change the sliders or trigger another event between any two calls. The next read observes the same live Zustand state.

## Limitations

- Final challenge QA should be run in ChatGPT's WebMCP-capable browser or Chrome 149+ with `chrome://flags/#enable-webmcp-testing` enabled.
- Registration is progressive enhancement; ordinary browsers continue to run CountryLab without tools.
- Current live advancement is bounded to 24 months per call.
- Snapshot-based event removal does not retroactively decompose damage already recorded before the source snapshot.
- The economy is deterministic; the current `rngState` is metadata rather than an active stochastic path.
- `compare_scenarios` reads comparisons already created by `run_counterfactual`; it does not invent arbitrary scenario files.

See [`WEBMCP_EVALS.md`](./WEBMCP_EVALS.md) for natural-language evaluation cases and expected/forbidden tools.

## Event vocabulary

Agent-facing tools consistently use `trade_conflict`. The deterministic engine may use `war` internally, but that internal label is not part of the WebMCP contract.
