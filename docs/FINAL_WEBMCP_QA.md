# Final WebMCP + production QA

Run this against the exact deployed commit before submission. Automated tests validate the underlying tool semantics and deterministic counterfactual behavior, but only a real WebMCP-capable browser can validate discovery, permissions, rendered UI behavior, and agent planning.

## Environment gate

1. Use ChatGPT's WebMCP-capable in-app browser, or Chrome 149+ with `chrome://flags/#enable-webmcp-testing` enabled and the browser restarted.
2. Open the submitted HTTPS URL from a non-owner/incognito/judge-equivalent account.
3. Confirm no access prompt blocks judges, or document working credentials in testing instructions if authentication is intentionally required.
4. Open DevTools and confirm no uncaught errors, failed runtime assets, or repeated registration warnings.
5. Disable WebMCP/reload once and confirm the human UI still works normally.
6. Re-enable WebMCP and inspect discovered tools. Expect exactly 17 CountryLab tools with no duplicates.
7. Reload/re-enter the page several times and confirm the tool count remains stable.

## Core flood investigation

1. Return to the clean baseline.
2. Read `get_country_state` and note the live month/policies.
3. **Human action:** manually trigger a Flood in Port.
4. **Human action:** advance six months.
5. Ask: **“Something changed. Investigate what happened.”**
   - Expected: observation tools first (`get_country_state`, history/inspect tools as needed).
   - Must not mutate live economic state.
6. Confirm the agent identifies the flood, Port, relevant imports/food/inflation changes, and the normalized reusable `eventId`.
7. Ask: **“Why did inflation increase?”**
   - Expected: `get_metric_history` + `get_causal_history`.
   - The causal result should connect the flood root to trade/import/food pressure and inflation.
8. Ask: **“Show me exactly what caused it.”**
   - Expected: `show_causal_chain` and/or `highlight_region` after causal inspection.
   - The webpage should visibly focus the same evidence for the human.

## Core Prove It experiment

1. Save the current `get_country_state` result for before/after comparison.
2. Ask: **“Prove the flood caused the inflation increase, but do not change my live country.”**
3. Expected: `run_counterfactual({ type: "remove_event", eventId: "event-…", months: ... })`.
4. Confirm returned `baseSnapshotId` is the saved flood checkpoint (`snapshot-event-…`), not a late post-damage snapshot.
5. Confirm `compare_scenarios` returns a measurable deterministic divergence.
6. Confirm `show_scenario_comparison` visibly opens the comparison UI.
7. Confirm the page clearly distinguishes **LIVE WORLD** from **ALTERNATE WORLD**.
8. Read `get_country_state` again and confirm the live country still matches the saved state from step 1.
9. Return to LIVE WORLD and confirm no alternate values leak into live controls/metrics/history.

## Later-intervention replay

1. Reset.
2. Trigger an oil shock.
3. Advance four months.
4. Change the interest rate manually to 7%.
5. Advance additional months.
6. Remove the oil shock in a counterfactual.
7. Confirm both baseline and alternate branches still contain the later 7% interest rate; only the selected oil shock differs.

## Human ↔ agent shared-state checks

1. Human changes interest rate in the UI.
2. Immediately call `get_country_state`; the new value must appear without scraping/reload.
3. Invoke `change_policy` through WebMCP.
4. The corresponding human UI control/metrics must update immediately.
5. Invoke `highlight_region`, `show_metric`, and `show_causal_chain`; they must change visible focus only, not economics.

## Invalid/error cases

Confirm each produces a clear error and leaves live state valid:

- interest rate above 20;
- invalid region;
- event with the wrong canonical region;
- invalid event ID;
- missing snapshot/comparison;
- stale/different snapshot lineage;
- pre-aborted/cancelled invocation where the browser exposes cancellation.

## Traffic/render QA

Watch the live animation for at least five uninterrupted minutes at baseline, then repeat during a major freight disruption.

- Vehicles remain on painted transport corridors.
- Bridges/junctions are used correctly.
- Vehicles never visibly cross grass, water, buildings, or labels.
- Vehicles face movement direction and do not drive backward/inverted.
- Opposing traffic occupies opposite lane offsets.
- Same-direction traffic queues rather than visibly overlapping/overtaking.
- Car/van/bus/truck silhouettes remain distinguishable.
- Route changes do not visibly teleport; junction fade/merge should hide route handoff.
- Disruption reduces/slows freight activity without breaking routes.
- Reduced-motion mode stops animated motion cleanly.

## Responsive/accessibility QA

Test approximately 1440px, 768px and 390px widths plus 200% browser text zoom.

- No clipped controls, metric values, causal rows or comparison tables.
- Country remains the visual centerpiece on desktop.
- LIVE/ALTERNATE distinction stays obvious on every width.
- Keyboard focus is visible and all DOM controls are reachable.
- Region controls provide keyboard access to the information represented by canvas regions.
- Screen reader announces the map summary and current active-event/region state.
- Status/error messages are announced appropriately.
- Reduced-motion behavior remains stable.

## Freeze failure conditions

Do not submit if any of these occur:

- judge-equivalent account cannot load/test the site;
- fewer/more than the intended 17 tools because registration failed/duplicated;
- observation calls mutate economics;
- counterfactual calls mutate live economics;
- later policy interventions disappear from an event-removal branch;
- stale snapshots silently produce an experiment instead of an explicit error;
- human changes are invisible to the next WebMCP read;
- WebMCP live mutations fail to update the visible UI;
- traffic visibly leaves roads/bridges or teleports;
- final deployment differs from the public repository/video commit.
