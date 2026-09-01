# Devpost submission draft

Replace bracketed placeholders only after the final deployed/public artifacts are verified. Do not publish this draft automatically.

## Project name

**CountryLab**

## One-line description

CountryLab turns a webpage into a shared deterministic economic laboratory where a human and an AI agent can observe, manipulate, explain, and experimentally test the same visible country through WebMCP.

## What it does

CountryLab is an interactive miniature country with a deterministic economy. A human can inspect regions and metrics, change interest rates/taxes/spending/tariffs, trigger shocks such as floods or oil shocks, and advance the simulation through time.

The same application exposes semantic WebMCP tools to an agent. Instead of scraping charts or clicking blindly, the agent can read the exact country state, inspect regions/sectors, query event and metric history, retrieve deterministic causal chains, mutate the live country when explicitly requested, or create isolated counterfactual experiments.

The flagship workflow is:

1. a human floods the port;
2. the agent observes the changed state through WebMCP;
3. it investigates event/metric/causal history;
4. it identifies the flood → trade/import disruption → supply pressure → inflation chain;
5. the human asks the agent to prove the claim without changing the live country;
6. the agent removes only that flood in an isolated branch while replaying later live interventions at their original times;
7. CountryLab compares both deterministic timelines and visibly opens the result;
8. the original live country remains unchanged.

## Why this is a good WebMCP use case

CountryLab is not primarily about letting an agent click a game. Its value comes from exposing domain semantics that are difficult and unreliable to recover through ordinary browser automation.

WebMCP gives the agent structured access to:

- exact simulation state rather than visual inference;
- stable region/sector/event identifiers;
- bounded metric and event histories;
- engine-generated causal provenance;
- deterministic domain actions;
- isolated counterfactual experimentation;
- visible shared-attention actions that return the agent's reasoning to the webpage.

That lets the human and agent collaborate on the same world as an experimental object, rather than treating the webpage as a collection of buttons to automate.

## How does WebMCP improve the user experience?

Without WebMCP, an agent would need to infer values and chronology from charts/DOM text, reconstruct causal relationships indirectly, and simulate UI clicks to manipulate the country. That is brittle and loses the distinction between observation, live mutation, and isolated experimentation.

With WebMCP, the agent can start read-only, understand exactly what the human changed, inspect the deterministic cause chain, then run a safe alternate timeline and show the result back in the human interface. Human actions are immediately visible to subsequent agent reads, and agent live actions immediately update the same UI.

The result is a shared human-agent workflow rather than parallel interfaces.

## What can humans and agents accomplish together now?

A human can create a shock or policy situation visually and ask open-ended questions such as “Something changed—investigate it” or “Prove the flood caused inflation without changing my country.”

The agent can independently gather evidence, identify the relevant region/event/metrics, retrieve deterministic causal provenance, formulate a counterfactual test, run the alternate timeline, compare outcomes, and visibly present that proof in the page.

The human can then intervene again and the agent immediately reasons from the updated shared world.

## How WebMCP was implemented

CountryLab uses the current imperative WebMCP API through `document.modelContext.registerTool(...)` with capability detection and registration-scoped `AbortSignal` cleanup.

The project exposes 17 semantic tools across four categories:

- observation/state/causal inspection;
- explicit live-world mutations;
- isolated snapshot/counterfactual comparison;
- visible UI focus/comparison actions.

Tool schemas use strict object shapes, enums, numeric bounds and `additionalProperties: false`. Read-only tools carry the read-only annotation; tools that alter economic or visible state do not.

The WebMCP layer does not implement economic formulas. Both the React/Phaser human interface and WebMCP actions use the same application-service/shared-state layer over the deterministic economy engine.

Counterfactual event removal uses event-time snapshots and replays subsequent recorded live actions into both branches, preserving later policy/event/time interventions while removing only the selected event. The alternate branch is cloned and cannot mutate the live country.

## Tech stack

- React
- Phaser
- TypeScript
- Zustand
- Vite
- WebMCP imperative API
- deterministic in-browser economy/counterfactual engine

## Links — fill after verification

- Live project: `[FINAL JUDGE-ACCESSIBLE HTTPS URL]`
- Public source repository: `[FINAL PUBLIC GITHUB/GITLAB/BITBUCKET URL]`
- Demo video: `[FINAL PUBLIC YOUTUBE URL, <3 MINUTES]`

## Testing instructions — final submission version

1. Open the live project in a WebMCP-capable ChatGPT browser or Chrome 149+ with the WebMCP testing flag enabled.
2. Return to the baseline world.
3. Manually trigger a Flood in Port and advance six months.
4. Ask the agent: “Something changed. Investigate what happened.”
5. Ask: “Why did inflation rise? Show me the chain.”
6. Ask: “Prove the flood caused the increase, but do not change my live country.”
7. Confirm the comparison UI opens and LIVE WORLD remains unchanged.

If the final deployment requires authentication, add working judge credentials here before submitting. Otherwise explicitly state that no credentials are required.

## Accuracy note

CountryLab is an educational toy causal model. It demonstrates transparent directional relationships and deterministic experimentation; it is not a real-world economic forecasting or policy-advice system.
