# Judge and agent testing guide

Use the deployed app at https://countrylab.vercel.app in ChatGPT's WebMCP-capable in-app browser or a WebMCP-enabled Chrome build.

CountryLab should expose exactly **17** WebMCP tools. Reloading or re-entering the page should not create duplicates.

## Recommended demo path

1. Return to the baseline country.
2. Manually trigger a **Flood** in **Port**.
3. Advance six months.
4. Ask the agent: **“Something changed. Investigate what happened.”**
   - Expected behavior: observation tools first; no unsolicited live mutation.
5. Ask: **“Why did inflation rise? Show me the chain.”**
   - Expected behavior: metric/causal inspection and a visible WHY view.
6. Ask: **“Prove the flood caused the increase, but do not change my live country.”**
   - Expected behavior: an isolated event-removal counterfactual, scenario comparison, and visible Prove It view.
7. Return to **LIVE WORLD** and confirm the original live metrics/policies/history were not overwritten by the alternate scenario.

## Shared-state check

- Change a policy manually, then ask the agent for the current country state. The new value should be visible immediately.
- Ask the agent to make an explicit policy change. The corresponding human UI should update immediately.
- Ask the agent to highlight a region or show a causal chain. The UI should change focus without changing economic state.

## Safety and error behavior

Useful negative tests:

- interest rate above the supported maximum;
- impossible event/region pairing;
- unknown event ID;
- unknown comparison ID;
- stale or incompatible snapshot lineage;
- counterfactual request that must not mutate the live country.

These should return clear errors while leaving live state valid.

## Production sanity checks

- The app loads without authentication or environment variables.
- The human interface still works when WebMCP is unavailable.
- The map and controls remain usable at desktop and narrow/mobile widths.
- Reduced-motion mode suppresses animated motion cleanly.
- Vehicles remain on authored roads/bridges and disruption changes activity rather than breaking routes.

## Local verification

```bash
npm ci
npm run verify
```

`npm run verify` executes the automated test suite followed by the production TypeScript/Vite build.

For deeper tool inspection during local development, use:

```text
http://localhost:5173/?webmcp-debug=1
```
