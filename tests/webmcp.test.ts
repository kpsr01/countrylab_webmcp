import assert from 'node:assert/strict';
import test from 'node:test';
import { executeWebMCPTool, getWebMCPToolDefinitions, registerWebMCPTools } from '../src/webmcp/registerTools.ts';
import { clearWebMCPExecutionLog, readWebMCPExecutionLog } from '../src/webmcp/executionLog.ts';
import { toolNames } from '../src/webmcp/toolDefinitions.ts';
import { useGameStore } from '../src/store/useGameStore.ts';

const signal = () => new AbortController().signal;

test('WebMCP exposes exactly seventeen semantic tools', () => {
  const definitions = getWebMCPToolDefinitions();
  assert.equal(toolNames.length, 17);
  assert.equal(new Set(toolNames).size, 17);
  assert.deepEqual(definitions.map((tool) => tool.name), toolNames);
  assert.ok(definitions.every((tool) => tool.inputSchema && (tool.inputSchema as { additionalProperties?: boolean }).additionalProperties === false));
  assert.ok(toolNames.includes('get_causal_history'));
  assert.ok(toolNames.includes('show_scenario_comparison'));
});

test('live reads observe human changes without exposing raw store state', async () => {
  useGameStore.getState().reset();
  useGameStore.getState().setPolicy('interestRate', 7);
  const result = await executeWebMCPTool('get_country_state', {}, { signal: signal() });
  assert.equal(result.policies.interestRate, 7);
  assert.equal('history' in result, false);
  assert.equal('branches' in result, false);
});

test('read tools do not mutate the live country', async () => {
  useGameStore.getState().reset();
  const before = structuredClone(useGameStore.getState().country);
  await executeWebMCPTool('get_country_state', {}, { signal: signal() });
  await executeWebMCPTool('get_event_history', {}, { signal: signal() });
  await executeWebMCPTool('inspect_region', { region: 'port' }, { signal: signal() });
  await executeWebMCPTool('inspect_sector', { sector: 'trade' }, { signal: signal() });
  const centralBank = await executeWebMCPTool('inspect_sector', { sector: 'central_bank' }, { signal: signal() });
  assert.equal(centralBank.id, 'central_bank');
  await executeWebMCPTool('get_metric_history', { metric: 'inflation', months: 6 }, { signal: signal() });
  await executeWebMCPTool('get_causal_history', { metric: 'inflation', months: 6 }, { signal: signal() });
  assert.deepEqual(useGameStore.getState().country, before);
});

test('live tools validate inputs and update the shared store', async () => {
  useGameStore.getState().reset();
  await assert.rejects(() => executeWebMCPTool('change_policy', { policy: 'interest_rate', value: 21 }, { signal: signal() }), /interestRate must be from 0 to 20/);
  await executeWebMCPTool('change_policy', { policy: 'interest_rate', value: 7 }, { signal: signal() });
  await assert.rejects(() => executeWebMCPTool('trigger_event', { event: 'flood', region: 'farmbelt' }, { signal: signal() }), /can only occur in port/);
  const result = await executeWebMCPTool('trigger_event', { event: 'flood', region: 'port', severity: 1.25 }, { signal: signal() });
  assert.equal(useGameStore.getState().country.policies.interestRate, 7);
  assert.equal(useGameStore.getState().country.activeEvents.length, 1);
  assert.equal(result.event.region, 'port');
  const advanced = await executeWebMCPTool('advance_months', { months: 2 }, { signal: signal() });
  assert.equal(advanced.month, 3);
});

test('counterfactual tools preserve live state and expose comparison IDs', async () => {
  useGameStore.getState().reset();
  const eventResult = await executeWebMCPTool('trigger_event', { event: 'flood', region: 'port' }, { signal: signal() });
  const eventId = eventResult.event.id;
  const before = structuredClone(useGameStore.getState().country);
  const result = await executeWebMCPTool('run_counterfactual', { type: 'remove_event', eventId, months: 6 }, { signal: signal() });
  assert.equal(result.liveCountryUnchanged, true);
  assert.deepEqual(useGameStore.getState().snapshots[result.baseSnapshotId].country, before);
  const compared = await executeWebMCPTool('compare_scenarios', { baselineScenarioId: result.baselineScenarioId, counterfactualScenarioId: result.counterfactualScenarioId }, { signal: signal() });
  assert.equal(compared.comparisonId, result.comparisonId);
  await executeWebMCPTool('show_scenario_comparison', { comparisonId: result.comparisonId }, { signal: signal() });
  assert.equal(useGameStore.getState().viewMode, 'alternate');
});

test('visual tools change visible selection without changing economics', async () => {
  useGameStore.getState().reset();
  const before = structuredClone(useGameStore.getState().country);
  await executeWebMCPTool('highlight_region', { region: 'energy' }, { signal: signal() });
  await executeWebMCPTool('show_causal_chain', { metric: 'inflation' }, { signal: signal() });
  assert.equal(useGameStore.getState().selectedRegion, 'energy');
  assert.equal(useGameStore.getState().highlightedMetric, 'inflation');
  assert.deepEqual(useGameStore.getState().country, before);
});

test('unsupported browsers receive a safe registration result', async () => {
  const previous = (globalThis as { document?: unknown }).document;
  delete (globalThis as { document?: unknown }).document;
  const result = await registerWebMCPTools();
  assert.equal(result.supported, false);
  assert.doesNotThrow(result.cleanup);
  if (previous) (globalThis as { document?: unknown }).document = previous;
});

test('a partial modelContext without registerTool is treated as unsupported', async () => {
  const previous = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = { modelContext: {} };
  const result = await registerWebMCPTools();
  assert.equal(result.supported, false);
  assert.equal(result.registered, false);
  assert.doesNotThrow(result.cleanup);
  delete (globalThis as { document?: unknown }).document;
  if (previous) (globalThis as { document?: unknown }).document = previous;
});

test('registration is idempotent and cleanup uses the registration signal', async () => {
  const previous = (globalThis as { document?: unknown }).document;
  const registered: Array<{ name: string; signal?: AbortSignal }> = [];
  const fakeContext = {
    registerTool: async (tool: { name: string }, options?: { signal?: AbortSignal }) => {
      registered.push({ name: tool.name, signal: options?.signal });
    },
    getTools: async () => registered.map(({ name }) => ({ name })),
  };
  (globalThis as { document?: unknown }).document = { modelContext: fakeContext };
  const first = await registerWebMCPTools();
  const second = await registerWebMCPTools();
  assert.equal(first.registered, true);
  assert.equal(second.registered, true);
  assert.equal(registered.length, 17);
  first.cleanup();
  assert.equal(registered.every((tool) => tool.signal?.aborted), true);
  delete (globalThis as { document?: unknown }).document;
  if (previous) (globalThis as { document?: unknown }).document = previous;
});



test('failed WebMCP registration can be retried without a page reload', async () => {
  const previous = (globalThis as { document?: unknown }).document;
  let shouldFail = true;
  const registered: string[] = [];
  const fakeContext = {
    registerTool: async (tool: { name: string }) => {
      if (shouldFail) throw new Error('temporary registration failure');
      registered.push(tool.name);
    },
  };
  (globalThis as { document?: unknown }).document = { modelContext: fakeContext };
  await assert.rejects(() => registerWebMCPTools(), /temporary registration failure/);
  shouldFail = false;
  const retry = await registerWebMCPTools();
  assert.equal(retry.registered, true);
  assert.equal(registered.length, 17);
  retry.cleanup();
  delete (globalThis as { document?: unknown }).document;
  if (previous) (globalThis as { document?: unknown }).document = previous;
});

test('execution logging records success and error with bounded structured data', async () => {
  clearWebMCPExecutionLog();
  await executeWebMCPTool('get_country_state', {}, { signal: signal() });
  await assert.rejects(() => executeWebMCPTool('inspect_region', { region: 'unknown' }, { signal: signal() }));
  const entries = readWebMCPExecutionLog();
  assert.equal(entries.length, 2);
  assert.equal(entries[0].success, true);
  assert.equal(entries[1].success, false);
  clearWebMCPExecutionLog();
  assert.equal(readWebMCPExecutionLog().length, 0);
});

test('event read tools expose normalized event IDs that can be reused directly', async () => {
  useGameStore.getState().reset();
  const triggered = await executeWebMCPTool('trigger_event', { event: 'flood', severity: 1.25 }, { signal: signal() });
  const eventId = triggered.event.eventId;
  await executeWebMCPTool('advance_months', { months: 1 }, { signal: signal() });
  const events = await executeWebMCPTool('get_event_history', {}, { signal: signal() });
  const eventEntry = events.find((entry: { eventId?: string }) => entry.eventId === eventId);
  assert.ok(eventEntry);
  assert.equal(eventEntry.eventId.startsWith('event:'), false);
  const causal = await executeWebMCPTool('get_causal_history', { metric: 'inflation', months: 6 }, { signal: signal() });
  const eventContributor = causal.contributors.find((entry: { eventId?: string }) => entry.eventId === eventId);
  assert.ok(eventContributor);
  assert.equal(eventContributor.eventId, eventId);
  assert.equal(String(eventContributor.sourceId).startsWith('event:'), false);
});

test('event counterfactuals automatically branch from the saved event checkpoint after live time has advanced', async () => {
  useGameStore.getState().reset();
  const triggered = await executeWebMCPTool('trigger_event', { event: 'flood', region: 'port', severity: 1.5 }, { signal: signal() });
  const eventId = triggered.event.eventId;
  const checkpointId = `snapshot-event-${eventId}`;
  const checkpoint = structuredClone(useGameStore.getState().snapshots[checkpointId]);
  await executeWebMCPTool('advance_months', { months: 6 }, { signal: signal() });
  const liveBefore = structuredClone(useGameStore.getState().country);
  const result = await executeWebMCPTool('run_counterfactual', { type: 'remove_event', eventId, months: 6 }, { signal: signal() });
  assert.equal(result.baseSnapshotId, checkpointId);
  assert.deepEqual(useGameStore.getState().snapshots[checkpointId], checkpoint);
  assert.deepEqual(useGameStore.getState().country, liveBefore);
  assert.ok(result.metricDifferences.importsIndex.difference > 0);
});

test('event counterfactual IDs accept causal-root prefixes but reject unknown events', async () => {
  useGameStore.getState().reset();
  const triggered = await executeWebMCPTool('trigger_event', { event: 'flood' }, { signal: signal() });
  const eventId = triggered.event.eventId;
  const prefixed = await executeWebMCPTool('run_counterfactual', { type: 'remove_event', eventId: `event:${eventId}`, months: 3 }, { signal: signal() });
  assert.equal(prefixed.intervention.eventId, eventId);
  await assert.rejects(
    () => executeWebMCPTool('run_counterfactual', { type: 'remove_event', eventId: 'event-999', months: 3 }, { signal: signal() }),
    /No event checkpoint is available|does not exist/,
  );
});

test('counterfactuals reject stale snapshot lineage instead of silently dropping later actions', async () => {
  useGameStore.getState().reset();
  const triggered = await executeWebMCPTool('trigger_event', { event: 'flood', severity: 1 }, { signal: signal() });
  const live = useGameStore.getState().country;
  const firstAction = live.actionHistory[0];
  assert.equal(firstAction.kind, 'event');
  if (firstAction.kind === 'event') firstAction.severity = 1.5;
  await assert.rejects(
    () => executeWebMCPTool('run_counterfactual', { type: 'remove_event', eventId: triggered.event.eventId, months: 3 }, { signal: signal() }),
    /stale or belongs to a different timeline/,
  );
  useGameStore.getState().reset();
});

test('preset scenarios retain event-time checkpoints for Prove It experiments', async () => {
  useGameStore.getState().reset();
  assert.equal(useGameStore.getState().loadScenario('port-flood'), true);
  const state = useGameStore.getState();
  const event = state.country.eventHistory[0];
  const checkpoint = state.snapshots[`snapshot-event-${event.id}`];
  assert.ok(checkpoint);
  assert.equal(checkpoint.sourceEventId, event.id);
  assert.ok(checkpoint.month < state.country.month);
  const result = await executeWebMCPTool('run_counterfactual', { type: 'remove_event', eventId: event.id, months: 6 }, { signal: signal() });
  assert.equal(result.baseSnapshotId, checkpoint.id);
  assert.ok(result.timelinesDiverged);
});

test('tool schemas encode engine policy ranges and event-region constraints', () => {
  const definitions = getWebMCPToolDefinitions();
  const policy = definitions.find((tool) => tool.name === 'change_policy');
  const trigger = definitions.find((tool) => tool.name === 'trigger_event');
  const compare = definitions.find((tool) => tool.name === 'compare_scenarios');
  assert.ok(policy);
  assert.ok(trigger);
  assert.ok(compare?.readOnly);
  const policyVariants = (policy.inputSchema as { oneOf?: Array<{ properties?: { policy?: { const?: string }; value?: { maximum?: number } } }> }).oneOf ?? [];
  assert.equal(policyVariants.find((variant) => variant.properties?.policy?.const === 'interest_rate')?.properties?.value?.maximum, 20);
  assert.equal(policyVariants.find((variant) => variant.properties?.policy?.const === 'tariff')?.properties?.value?.maximum, 50);
  const eventVariants = (trigger.inputSchema as { oneOf?: Array<{ properties?: { event?: { const?: string }; region?: { const?: string } } }> }).oneOf ?? [];
  assert.equal(eventVariants.find((variant) => variant.properties?.event?.const === 'flood')?.properties?.region?.const, 'port');
  assert.equal(eventVariants.find((variant) => variant.properties?.event?.const === 'oil_shock')?.properties?.region?.const, 'energy');
});


test('agent-facing WebMCP results consistently normalize trade conflict terminology', async () => {
  useGameStore.getState().reset();
  const triggered = await executeWebMCPTool('trigger_event', { event: 'trade_conflict', region: 'industrial', severity: 1.25 }, { signal: signal() });
  const eventId = triggered.event.eventId;

  const country = await executeWebMCPTool('get_country_state', {}, { signal: signal() });
  assert.equal(country.activeEvents[0].type, 'trade_conflict');

  const history = await executeWebMCPTool('get_event_history', {}, { signal: signal() });
  assert.equal(history.find((entry: { eventId?: string }) => entry.eventId === eventId)?.eventType, 'trade_conflict');

  const region = await executeWebMCPTool('inspect_region', { region: 'industrial' }, { signal: signal() });
  assert.equal(region.recentEvents[0].type, 'trade_conflict');

  const comparison = await executeWebMCPTool('run_counterfactual', { type: 'remove_event', eventId, months: 3 }, { signal: signal() });
  assert.equal(comparison.intervention.eventType, 'trade_conflict');
});
