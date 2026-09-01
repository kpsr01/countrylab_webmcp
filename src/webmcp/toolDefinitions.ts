import type { MetricKey } from '../economy/types.ts';
import { advanceSchema, causalHistorySchema, changePolicySchema, comparisonSchema, compareSchema, counterfactualSchema, emptySchema, emergencySchema, highlightSchema, inspectRegionSchema, inspectSectorSchema, metricHistorySchema, metricSchema, snapshotSchema, triggerEventSchema } from './toolSchemas.ts';
export type ToolName = 'get_country_state' | 'inspect_region' | 'inspect_sector' | 'get_metric_history' | 'get_event_history' | 'get_causal_history' | 'change_policy' | 'trigger_event' | 'provide_emergency_response' | 'advance_months' | 'create_snapshot' | 'run_counterfactual' | 'compare_scenarios' | 'highlight_region' | 'show_metric' | 'show_causal_chain' | 'show_scenario_comparison';
export type ToolDescriptor = { name: ToolName; title: string; description: string; inputSchema: object; readOnly?: boolean };

const read = (name: ToolName, title: string, description: string, inputSchema: object): ToolDescriptor => ({ name, title, description, inputSchema, readOnly: true });
const live = (name: ToolName, title: string, description: string, inputSchema: object): ToolDescriptor => ({ name, title, description, inputSchema });

export const toolDescriptors: ToolDescriptor[] = [
  read('get_country_state', 'Get country state', 'Read a concise semantic snapshot of the CURRENT LIVE country. Use before investigating or acting; this never changes the simulation.', emptySchema),
  read('inspect_region', 'Inspect region', 'Inspect one live region: infrastructure health, productivity, damage, capacity, related metrics, events, and disruptions. Read-only; it does not change the live country.', inspectRegionSchema),
  read('inspect_sector', 'Inspect sector', 'Inspect one live economic sector and its current output, health, capacity, and causal roots. Read-only; it does not change the live country.', inspectSectorSchema),
  read('get_metric_history', 'Get metric history', 'Read bounded historical values for one live metric. Use this to find when an outcome changed before asking why. Read-only; it does not change the live country.', metricHistorySchema),
  read('get_event_history', 'Get event history', 'Read major shocks and policy decisions in the live timeline with months, effects, and causal references. Read-only; it does not change the live country.', emptySchema),
  read('get_causal_history', 'Get causal history', 'Explain WHY a live metric changed using deterministic causal contributors and human-readable chains. Read-only; it does not change the live country.', causalHistorySchema),
  live('change_policy', 'Change live policy', 'Change one policy in the CURRENT LIVE country. This mutates the user-visible simulation immediately; use only when the user explicitly asks to change policy.', changePolicySchema),
  live('trigger_event', 'Trigger live event', 'Trigger one supported shock in the CURRENT LIVE country. This mutates the user-visible simulation immediately. Region is optional because each shock has one modeled canonical region; if provided it must match that event.', triggerEventSchema),
  live('provide_emergency_response', 'Provide emergency response', 'Set live emergency spending for disaster response. This mutates the CURRENT LIVE country and is the only emergency-response lever currently modeled.', emergencySchema),
  live('advance_months', 'Advance live simulation', 'Advance the CURRENT LIVE country by 1–24 deterministic months. This mutates live history and metrics immediately; use after a requested policy or event change.', advanceSchema),
  live('create_snapshot', 'Create live snapshot', 'Capture the CURRENT LIVE country as an isolated snapshot for later experiments. It does not alter economic metrics, but adds a user-visible saved snapshot.', snapshotSchema),
  live('run_counterfactual', 'Run isolated counterfactual', 'Run an isolated alternate timeline without modifying the user’s live country. Event interventions automatically branch from the saved event checkpoint unless an explicit valid snapshotId is supplied, preventing already-realized damage from contaminating the experiment. Use normalized eventId values returned by read tools.', counterfactualSchema),
  read('compare_scenarios', 'Compare scenarios', 'Return a structured comparison already produced by an isolated experiment. Use the baseline and counterfactual scenario IDs from run_counterfactual; this is read-only and does not mutate the live country.', compareSchema),
  live('highlight_region', 'Highlight region', 'Select and highlight a region in the same visible CountryLab map and open its inspector context. This changes UI focus only, not the live economy.', highlightSchema),
  live('show_metric', 'Show metric', 'Select a metric in the same visible CountryLab dashboard so the user can see its WHY explanation. This changes UI focus only, not the live economy.', metricSchema),
  live('show_causal_chain', 'Show causal chain', 'Select a metric and open its deterministic WHY causal explanation in the visible webpage. This changes UI focus only, not the live economy.', metricSchema),
  live('show_scenario_comparison', 'Show scenario comparison', 'Show an existing isolated comparison in the visible Prove It interface. This changes UI view only and never changes the live country.', comparisonSchema),
];

export const toolNames = toolDescriptors.map(({ name }) => name);
export type MetricToolInput = { metric: MetricKey };
