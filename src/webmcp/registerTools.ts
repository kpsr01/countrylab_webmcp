import { useGameStore } from '../store/useGameStore.ts';
import { advanceMonths, changePolicy, getCausalHistory, getEventHistory, getMetricHistory, inspectRegion, inspectSector, summarizeCountryState, triggerEvent, EVENT_REGION, POLICY_LIMITS, toAgentEventType } from '../application/countryLabService.ts';
import type { EventType, MetricKey, PolicyKey, RegionId, ScenarioIntervention, ScenarioSnapshot, SectorId } from '../economy/types.ts';
import { METRICS, REGIONS, SECTORS } from './toolSchemas.ts';
import { toolDescriptors, toolNames, type ToolName } from './toolDefinitions.ts';
import { clearWebMCPExecutionLog, readWebMCPExecutionLog, recordWebMCPExecution } from './executionLog.ts';
import type { ModelContext } from './webmcp.types.ts';
const policyMap: Record<string, PolicyKey> = { interest_rate: 'interestRate', income_tax: 'incomeTax', corporate_tax: 'corporateTax', government_spending: 'governmentSpending', tariff: 'tariffRate', emergency_spending: 'emergencySpending' };
const eventMap: Record<string, EventType> = { flood: 'flood', drought: 'drought', oil_shock: 'oil_shock', trade_conflict: 'war', banking_crisis: 'banking_crisis', productivity_boom: 'productivity_boom' };
const readablePolicy = (key: PolicyKey) => key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
const asRecord = (input: unknown) => (input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {});
const requiredString = (input: Record<string, unknown>, key: string) => { const value = input[key]; if (typeof value !== 'string' || !value) throw new Error(`${key} is required.`); return value; };
const requiredNumber = (input: Record<string, unknown>, key: string) => { const value = input[key]; if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${key} must be a finite number.`); return value; };
const numberInRange = (value: number, min: number, max: number, key: string) => { if (value < min || value > max) throw new Error(`${key} must be from ${min} to ${max}.`); return value; };
const integerInRange = (value: number, min: number, max: number, key: string) => { if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${key} must be an integer from ${min} to ${max}.`); return value; };
const oneOf = <T extends string>(value: string, values: readonly T[], key: string): T => { if (!values.includes(value as T)) throw new Error(`Unsupported ${key} '${value}'.`); return value as T; };
const short = (value: unknown) => { const text = JSON.stringify(value); return text && text.length > 240 ? `${text.slice(0, 237)}...` : text ?? 'No result'; };
const normalizeEventId = (value: string) => value.startsWith('event:') ? value.slice('event:'.length) : value;

function currentState() { return useGameStore.getState(); }
function sourceSnapshot(snapshotId?: string) {
  const state = currentState();
  if (snapshotId) {
    const snapshot = state.snapshots[snapshotId];
    if (!snapshot) throw new Error(`Snapshot '${snapshotId}' was not found.`);
    return snapshot;
  }
  const snapshot = state.snapshots[state.baseSnapshotId] ?? state.snapshot;
  if (!snapshot) throw new Error('No live snapshot is available.');
  return snapshot;
}


function sourceSnapshotForEvent(rawEventId: string, explicitSnapshotId?: string) {
  const state = currentState();
  const eventId = normalizeEventId(rawEventId);
  const source = explicitSnapshotId
    ? sourceSnapshot(explicitSnapshotId)
    : Object.values(state.snapshots).find((snapshot) => snapshot.sourceEventId === eventId);
  if (!source) {
    throw new Error(`No event checkpoint is available for '${eventId}'. Run get_event_history to obtain a valid eventId, or provide a snapshotId that contains the event.`);
  }
  const event = source.country.eventHistory.find((candidate) => candidate.id === eventId);
  if (!event) throw new Error(`Event '${eventId}' does not exist in snapshot '${source.id}'.`);
  return { eventId, source, event };
}

function externalizeIntervention(intervention: ScenarioIntervention) {
  if (intervention.kind === 'event') return { ...intervention, eventType: intervention.eventType ? toAgentEventType(intervention.eventType) : undefined };
  if (intervention.kind === 'eventSeverity') return { ...intervention };
  return { ...intervention };
}

function comparisonSummary(comparison: ReturnType<typeof useGameStore.getState>['comparisons'][string]) {
  return {
    comparisonId: comparison.id,
    baselineScenarioId: comparison.baseline.id,
    counterfactualScenarioId: comparison.counterfactual.id,
    baseSnapshotId: comparison.baseSnapshotId,
    intervention: externalizeIntervention(comparison.intervention),
    monthsSimulated: comparison.monthsSimulated,
    divergenceMonth: comparison.divergenceMonth,
    timelinesDiverged: comparison.timelinesDiverged,
    summary: comparison.summary,
    metricDifferences: comparison.metricDifferences,
    causalDifferences: comparison.causalDifferences.slice(0, 8),
  };
}

async function execute(name: ToolName, rawInput: unknown, options: { signal: AbortSignal }) {
  if (options.signal.aborted) throw options.signal.reason ?? new Error('Tool execution was cancelled.');
  const input = asRecord(rawInput);
  const state = currentState();
  switch (name) {
    case 'get_country_state': return summarizeCountryState(state.country);
    case 'inspect_region': return inspectRegion(state.country, oneOf(requiredString(input, 'region'), REGIONS, 'region'));
    case 'inspect_sector': return inspectSector(state.country, oneOf(requiredString(input, 'sector'), SECTORS, 'sector'));
    case 'get_metric_history': return getMetricHistory(state.country, oneOf(requiredString(input, 'metric'), METRICS, 'metric'), input.months as number | undefined);
    case 'get_event_history': return getEventHistory(state.country);
    case 'get_causal_history': return getCausalHistory(state.country, oneOf(requiredString(input, 'metric'), METRICS, 'metric'), input.months as number | undefined);
    case 'change_policy': {
      const external = requiredString(input, 'policy');
      const key = policyMap[external];
      if (!key) throw new Error(`Unsupported policy '${external}'.`);
      const value = requiredNumber(input, 'value');
      const previousValue = state.country.policies[key];
      changePolicy(state.country, key, value);
      state.setPolicy(key, value);
      return { success: true, action: name, policy: external, previousValue, newValue: currentState().country.policies[key], month: currentState().country.month, confirmation: `${readablePolicy(key)} changed in the live country.` };
    }
    case 'trigger_event': {
      const external = requiredString(input, 'event');
      const type = eventMap[external];
      if (!type) throw new Error(`Unsupported event '${external}'.`);
      const expectedRegion = EVENT_REGION[type];
      const region = input.region === undefined ? expectedRegion : oneOf(requiredString(input, 'region'), REGIONS, 'region');
      if (expectedRegion !== region) throw new Error(`${external} can only occur in ${expectedRegion}.`);
      const severity = input.severity === undefined ? 1 : requiredNumber(input, 'severity');
      const before = state.country.eventHistory.length;
      const validated = triggerEvent(state.country, type, region, severity);
      state.addEvent(type, region, severity);
      const event = validated.eventHistory.at(-1);
      return { success: true, action: name, event: event ? { eventId: event.id, id: event.id, type: external, region, severity: event.severity, durationMonths: event.durationMonths } : null, previousEventCount: before, month: currentState().country.month, confirmation: 'The shock was added to the live country.' };
    }
    case 'provide_emergency_response': {
      const spending = requiredNumber(input, 'spending');
      const previousValue = state.country.policies.emergencySpending;
      changePolicy(state.country, 'emergencySpending', spending);
      state.setPolicy('emergencySpending', spending);
      return { success: true, action: name, previousValue, newValue: currentState().country.policies.emergencySpending, month: currentState().country.month, confirmation: 'Emergency response spending changed in the live country.' };
    }
    case 'advance_months': {
      const months = requiredNumber(input, 'months');
      const before = state.country.metrics;
      advanceMonths(state.country, months);
      state.advance(months);
      const after = currentState().country;
      return { success: true, action: name, monthsAdvanced: months, month: after.month, metricChanges: Object.fromEntries(Object.keys(after.metrics).map((key) => [key, Number((after.metrics[key as MetricKey] - before[key as MetricKey]).toFixed(2))])), activeEvents: after.activeEvents, confirmation: 'The live country advanced deterministically.' };
    }
    case 'create_snapshot': {
      const snapshot = state.captureScenarioSnapshot(typeof input.label === 'string' ? input.label : 'Agent snapshot');
      return { success: true, action: name, snapshotId: snapshot.id, label: snapshot.label, month: snapshot.month, summary: summarizeCountryState(snapshot.country) };
    }
    case 'run_counterfactual': {
      const type = requiredString(input, 'type');
      const months = integerInRange(requiredNumber(input, 'months'), 1, 36, 'months');
      let source: ScenarioSnapshot;
      let intervention: ScenarioIntervention;
      let counterfactualLabel = 'Agent alternate world';
      if (type === 'remove_event') {
        const resolved = sourceSnapshotForEvent(requiredString(input, 'eventId'), typeof input.snapshotId === 'string' ? input.snapshotId : undefined);
        source = resolved.source;
        intervention = { kind: 'event', action: 'remove', eventId: resolved.eventId, eventType: resolved.event.type, region: resolved.event.region };
        counterfactualLabel = `Without ${toAgentEventType(resolved.event.type).replaceAll('_', ' ')}`;
      } else if (type === 'change_policy') {
        const external = requiredString(input, 'policy');
        const key = policyMap[external];
        if (!key) throw new Error(`Unsupported policy '${external}'.`);
        source = typeof input.snapshotId === 'string' ? sourceSnapshot(input.snapshotId) : state.captureScenarioSnapshot('Agent baseline');
        const [min, max] = POLICY_LIMITS[key];
        intervention = { kind: 'policy', key, value: numberInRange(requiredNumber(input, 'value'), min, max, 'value') };
      } else if (type === 'change_event_severity') {
        const resolved = sourceSnapshotForEvent(requiredString(input, 'eventId'), typeof input.snapshotId === 'string' ? input.snapshotId : undefined);
        source = resolved.source;
        intervention = { kind: 'eventSeverity', eventId: resolved.eventId, severity: numberInRange(requiredNumber(input, 'severity'), 0.25, 2, 'severity') };
        counterfactualLabel = `${intervention.severity.toFixed(1)}× ${toAgentEventType(resolved.event.type).replaceAll('_', ' ')}`;
      } else throw new Error(`Unsupported counterfactual type '${type}'.`);
      const comparison = state.runExperiment(intervention, months, source.id, { baseline: source.label, counterfactual: counterfactualLabel }, { signal: options.signal });
      if (!comparison) throw new Error('The counterfactual could not be created.');
      return { success: true, action: name, ...comparisonSummary(comparison), liveCountryUnchanged: true };
    }
    case 'compare_scenarios': {
      const baseline = requiredString(input, 'baselineScenarioId');
      const counterfactual = requiredString(input, 'counterfactualScenarioId');
      const comparison = Object.values(state.comparisons).find((candidate) => candidate.baseline.id === baseline && candidate.counterfactual.id === counterfactual);
      if (!comparison) throw new Error(`No comparison found for '${baseline}' versus '${counterfactual}'.`);
      return { success: true, action: name, ...comparisonSummary(comparison) };
    }
    case 'highlight_region': {
      const region = oneOf(requiredString(input, 'region'), REGIONS, 'region');
      state.selectRegion(region);
      return { success: true, action: name, region, visible: true };
    }
    case 'show_metric': {
      const metric = oneOf(requiredString(input, 'metric'), METRICS, 'metric');
      state.highlightMetric(metric);
      return { success: true, action: name, metric, visible: true };
    }
    case 'show_causal_chain': {
      const metric = oneOf(requiredString(input, 'metric'), METRICS, 'metric');
      state.highlightMetric(metric);
      return { success: true, action: name, metric, visible: true, explanation: getCausalHistory(currentState().country, metric, 36) };
    }
    case 'show_scenario_comparison': {
      const comparisonId = requiredString(input, 'comparisonId');
      if (!state.showComparison(comparisonId)) throw new Error(`Comparison '${comparisonId}' was not found.`);
      return { success: true, action: name, comparisonId, visible: true };
    }
  }
}

export async function executeWebMCPTool(name: ToolName, input: unknown = {}, options: { signal: AbortSignal } = { signal: new AbortController().signal }) {
  const started = performance.now();
  try {
    const result = await execute(name, input, options);
    recordWebMCPExecution({ name, input: asRecord(input), success: true, duration: Math.round(performance.now() - started), summary: short(result) });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    recordWebMCPExecution({ name, input: asRecord(input), success: false, error: message, duration: Math.round(performance.now() - started), summary: message });
    throw new Error(message);
  }
}

export const getWebMCPToolDefinitions = () => toolDescriptors.map((descriptor) => structuredClone(descriptor));
export { clearWebMCPExecutionLog, readWebMCPExecutionLog, toolNames };

export interface WebMCPRegistration {
  supported: boolean;
  registered: boolean;
  toolNames: string[];
  cleanup: () => void;
  error?: string;
}

type RegistrationState = { promise: Promise<WebMCPRegistration>; controller: AbortController };
const registrationKey = Symbol.for('countrylab.webmcp.registration');
const globalState = globalThis as typeof globalThis & { [registrationKey]?: RegistrationState };

export async function registerWebMCPTools(): Promise<WebMCPRegistration> {
  if (globalState[registrationKey]) return globalState[registrationKey].promise;
  const context = typeof document === 'undefined' ? undefined : document.modelContext;
  if (!context || typeof context.registerTool !== 'function') return { supported: false, registered: false, toolNames: [], cleanup: () => undefined };
  const controller = new AbortController();
  const promise = (async () => {
    try {
      await Promise.all(toolDescriptors.map((descriptor) => context.registerTool({
        name: descriptor.name,
        title: descriptor.title,
        description: descriptor.description,
        inputSchema: descriptor.inputSchema,
        annotations: descriptor.readOnly ? { readOnlyHint: true } : undefined,
        execute: (input, options) => executeWebMCPTool(descriptor.name, input, options),
      }, { signal: controller.signal })));
    } catch (error) {
      controller.abort(error);
      if (globalState[registrationKey]?.controller === controller) delete globalState[registrationKey];
      throw error;
    }
    let cleaned = false;
    const cleanup = () => { if (!cleaned) { cleaned = true; controller.abort(); if (globalState[registrationKey]?.promise === promise) delete globalState[registrationKey]; } };
    return { supported: true, registered: true, toolNames: [...toolNames], cleanup };
  })();
  globalState[registrationKey] = { promise, controller };
  return promise;
}
