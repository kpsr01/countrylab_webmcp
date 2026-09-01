# CountryLab WebMCP tool contract

CountryLab exposes a semantic interface over the same application state used by the React and Phaser human interface. WebMCP handlers do not contain economic formulas; they call the shared application/service layer.

## Registration and execution

CountryLab uses the imperative API:

```ts
document.modelContext.registerTool(tool, { signal });
```

Registration is capability-detected and scoped to an `AbortController`. Tool execution accepts the browser/client execution options when present, honors a real cancellation signal, and safely falls back to a non-aborted local signal when a client invokes a tool without execution options.

The project uses `webmcp-types@0.1.5` for the browser declarations.

References:

- https://webmachinelearning.github.io/webmcp/
- https://developer.chrome.com/docs/ai/webmcp/imperative-api
- https://www.npmjs.com/package/webmcp-types

## Tools

### Observation

These tools carry `readOnlyHint: true` and never mutate the live country.

| Tool | Input | Returns / purpose |
| --- | --- | --- |
| `get_country_state` | none | Current month, policies, metrics, active events, warnings and semantic summary. |
| `inspect_region` | `region` | Region health, productivity, damage, capacity, sectors, metrics and recent events. |
| `inspect_sector` | `sector` | Sector output, health, capacity and causal roots. |
| `get_metric_history` | `metric`, optional `months` | Bounded historical month/value pairs. |
| `get_event_history` | none | Ordered shocks and policy decisions with reusable event IDs. |
| `get_causal_history` | `metric`, optional `months` | Deterministic causal contributors and human-readable chains. |

### Explicit live actions

These tools modify the same live country visible in the webpage and are described as mutations so an agent can distinguish them from observation.

| Tool | Input | Effect |
| --- | --- | --- |
| `change_policy` | `policy`, `value` | Changes one live policy. |
| `trigger_event` | `event`, optional canonical `region`, optional `severity` | Adds one modeled shock to its valid region. |
| `provide_emergency_response` | `spending` | Changes live emergency spending. |
| `advance_months` | `months` (1–24) | Advances the deterministic live simulation. |
| `create_snapshot` | optional `label` | Captures the current live country for later experiments. |

### Isolated experiments

| Tool | Input | Effect |
| --- | --- | --- |
| `run_counterfactual` | intervention, `months` (1–36), optional snapshot | Creates an alternate deterministic branch without changing live economic state. |
| `compare_scenarios` | returned baseline/counterfactual scenario IDs | Reads an existing comparison without rerunning it. |

`run_counterfactual` supports event removal, policy changes and event-severity changes. Event experiments normally branch from a saved event-time checkpoint and replay later recorded interventions at their original points in time, so the comparison can represent “same timeline except this event.” Stale or incompatible snapshot lineage is rejected explicitly rather than silently producing an invalid comparison.

### Visible explanation

These actions modify UI focus only; they do not mutate economic state.

| Tool | Input | Effect |
| --- | --- | --- |
| `highlight_region` | `region` | Selects the matching map region and inspector context. |
| `show_metric` | `metric` | Selects the dashboard metric. |
| `show_causal_chain` | `metric` | Opens the visible WHY explanation. |
| `show_scenario_comparison` | `comparisonId` | Opens an existing Prove It comparison. |

## Shared-state guarantee

Human controls and WebMCP actions use the same application store/service path. A policy changed manually is visible to the next `get_country_state` call. A policy changed through WebMCP updates the human UI immediately. Counterfactual branches are cloned and remain separate from the live world.

## Event vocabulary

Agent-facing tools consistently use `trade_conflict`. The deterministic engine may use `war` internally; that internal label is not part of the WebMCP contract.

## Debug inspector

With the development server running, open:

```text
http://localhost:5173/?webmcp-debug=1
```

The inspector reports capability status, expected definitions, browser-discovered registrations when `getTools()` is available, schemas, handler output and recent bounded execution logs.

## Progressive enhancement

If `document.modelContext.registerTool` is unavailable, registration returns a safe unsupported result and the normal human-facing application continues to function.
