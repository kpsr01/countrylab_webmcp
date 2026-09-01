# CountryLab — a shared economic laboratory for humans and agents

**Live:** https://countrylab.vercel.app  
**WebMCP Challenge:** https://webmcp.devpost.com/  
**License:** MIT

CountryLab is a deterministic economic simulation where a human and an AI agent operate the same visible mini-country. A human can change policy, trigger shocks, inspect regions, and advance time. Through WebMCP, an agent can read the exact semantic state, investigate causal history, make explicitly requested live changes, run isolated counterfactual experiments, and show its evidence back in the webpage.

> **Human changes the world → agent observes → agent investigates why → agent tests the claim safely → the webpage shows the proof.**

## Why WebMCP

CountryLab is deliberately built around domain semantics that are unreliable to recover through ordinary browser automation. An agent should not need to infer economic values from pixels, reconstruct chronology from chart labels, or click through controls just to understand what happened.

WebMCP gives the agent structured access to:

- the current live country state;
- stable region, sector, metric, event, snapshot, and comparison identifiers;
- bounded metric/event history;
- deterministic causal provenance;
- explicit live-world mutations;
- isolated counterfactual experiments; and
- visible UI focus actions that return the agent's reasoning to the human interface.

This creates a shared human-agent workflow rather than separate interfaces: human actions are immediately visible to the next agent read, and agent actions update the same application state the human sees.

## Flagship workflow

1. A human triggers a **Flood** in the **Port** and advances time.
2. The agent investigates with read-only WebMCP tools.
3. It identifies the deterministic chain from flood → trade/import disruption → supply pressure → inflation.
4. The human asks the agent to prove the claim without changing the live country.
5. CountryLab branches from the saved event-time checkpoint, removes only the selected flood, and replays later interventions into both timelines.
6. The agent compares the deterministic outcomes and opens the visible **Prove It** comparison.
7. The original **LIVE WORLD** remains unchanged.

## WebMCP surface

CountryLab exposes **17 semantic tools** through the imperative API:

```ts
document.modelContext.registerTool(tool, { signal });
```

### Observation — read only

`get_country_state`, `inspect_region`, `inspect_sector`, `get_metric_history`, `get_event_history`, `get_causal_history`

### Explicit live actions

`change_policy`, `trigger_event`, `provide_emergency_response`, `advance_months`, `create_snapshot`

### Isolated experiments

`run_counterfactual`, `compare_scenarios`

### Visible explanation

`highlight_region`, `show_metric`, `show_causal_chain`, `show_scenario_comparison`

Observation tools carry `readOnlyHint: true`. Live mutations are explicit in their names/descriptions. Counterfactuals operate on cloned scenario state and do not overwrite the live economy. UI tools change visible focus only.

The execution boundary also tolerates clients that omit execution options while still honoring real `AbortSignal` cancellation when supplied.

See [`docs/WEBMCP_TOOLS.md`](docs/WEBMCP_TOOLS.md) for the complete contract.

## Architecture

```text
Human UI ─┐
          ├── application service ── deterministic economy engine
WebMCP ───┘          │
                     └── shared Zustand state ── React + Phaser
```

Economic formulas live in the deterministic engine/application layer, not in WebMCP handlers or Phaser presentation code. That keeps human and agent behavior on one source of truth.

## Run locally

Requirements: Node.js 22.12+

```bash
npm ci
npm run dev
```

Open `http://localhost:5173`.

No API keys, credentials, backend services, or environment variables are required. CountryLab also works as a normal human-facing web app when WebMCP is unavailable; tool registration is progressive enhancement.

## Verify

```bash
npm run verify
```

Equivalent explicit commands:

```bash
npm run typecheck
npm test
npm run build
```

For browser/agent verification, follow [`docs/TESTING.md`](docs/TESTING.md). CountryLab has been exercised with ChatGPT's WebMCP-capable agent browser.

A development-only inspector is available at:

```text
http://localhost:5173/?webmcp-debug=1
```

It shows capability status, expected definitions, browser-discovered tool names when available, schemas, handler output, and bounded execution logs.

## Project notes

- [`docs/ECONOMY_MODEL.md`](docs/ECONOMY_MODEL.md) — scope and causal-model assumptions.
- [`docs/WEBMCP_TOOLS.md`](docs/WEBMCP_TOOLS.md) — tool contract and behavior.
- [`docs/TESTING.md`](docs/TESTING.md) — concise judge/agent test path.
- [`docs/ASSETS.md`](docs/ASSETS.md) — runtime artwork note.

CountryLab is an educational toy causal model. It demonstrates transparent directional relationships and deterministic experimentation; it is **not** a real-world economic forecasting or policy-advice system.

## License

MIT — see [`LICENSE`](LICENSE).
