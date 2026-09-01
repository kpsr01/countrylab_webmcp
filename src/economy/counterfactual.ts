import { advanceMonths, changePolicy, triggerEvent as triggerEventAction } from './engine.ts';
import type {
  ActiveEvent,
  CountryState,
  CausalContributor,
  EventType,
  HistoryPoint,
  MetricKey,
  RegionId,
  ScenarioBranch,
  ScenarioCausalDifference,
  ScenarioComparisonResult,
  ScenarioIntervention,
  ScenarioMetricDifference,
  ScenarioRunResult,
  ScenarioSnapshot,
  SnapshotSource,
  RunCounterfactualOptions,
  SimulationAction,
} from './types.ts';

const METRICS = Object.keys({
  gdp: 0, inflation: 0, unemployment: 0, debtPct: 0, foodIndex: 0, energyIndex: 0,
  industrialOutput: 0, importsIndex: 0, exportsIndex: 0, confidence: 0,
}) as MetricKey[];
const REGION_SECTOR: Record<RegionId, keyof CountryState['sectors']> = {
  capital: 'government', farmbelt: 'agriculture', industrial: 'manufacturing', port: 'trade', energy: 'energy',
};
const EVENT_LABEL: Record<EventType, string> = {
  flood: 'Flood', drought: 'Drought', war: 'Conflict', oil_shock: 'Energy shock', banking_crisis: 'Banking crisis', productivity_boom: 'Productivity boom',
};
const POLICY_LABEL: Record<keyof CountryState['policies'], string> = {
  interestRate: 'Interest Rates', incomeTax: 'Income Taxes', corporateTax: 'Corporate Taxes', governmentSpending: 'Government Spending', tariffRate: 'Tariffs', emergencySpending: 'Emergency Relief',
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw signal.reason ?? new Error('Counterfactual execution was cancelled.');
}

function eventMatches(event: ActiveEvent, intervention: Extract<ScenarioIntervention, { kind: 'event' | 'eventSeverity' }>) {
  if (intervention.eventId && event.id !== intervention.eventId) return false;
  if ('eventType' in intervention && intervention.eventType && event.type !== intervention.eventType) return false;
  if ('region' in intervention && intervention.region && event.region !== intervention.region) return false;
  return true;
}

function removeEvent(state: CountryState, intervention: Extract<ScenarioIntervention, { kind: 'event' }>) {
  const removed = state.eventHistory.filter((event) => eventMatches(event, intervention));
  const removedIds = new Set(removed.map((event) => event.id));
  state.activeEvents = state.activeEvents.filter((event) => !removedIds.has(event.id));
  state.eventHistory = state.eventHistory.filter((event) => !removedIds.has(event.id));
  state.actionHistory = state.actionHistory.filter((action) => action.kind !== 'event' || !removedIds.has(action.eventId));
  state.log = state.log.filter((entry) => !entry.causes?.some((cause) => removedIds.has(cause.replace('event:', ''))));
  for (const id of removedIds) {
    delete state.eventResiduals[id];
    const root = `event:${id}`;
    for (const key of Object.keys(state.metricRoots) as MetricKey[]) state.metricRoots[key] = state.metricRoots[key]?.filter((node) => node !== root);
    for (const key of Object.keys(state.causalBranches)) state.causalBranches[key] = state.causalBranches[key].filter((node) => node !== root);
    for (const sector of Object.values(state.sectors)) sector.causalRoots = sector.causalRoots.filter((node) => node !== root);
  }
  return state;
}

function changeEventSeverity(state: CountryState, intervention: Extract<ScenarioIntervention, { kind: 'eventSeverity' }>) {
  const severity = Math.max(0.25, Math.min(2, Number.isFinite(intervention.severity) ? intervention.severity : 1));
  const active = state.activeEvents.find((event) => event.id === intervention.eventId);
  const history = state.eventHistory.find((event) => event.id === intervention.eventId);
  const source = history ?? active;
  const previousSeverity = source?.severity ?? severity;
  if (source) {
    const elapsed = Math.max(0, source.durationMonths - source.monthsRemaining);
    const durationMonths = Math.max(1, Math.round(source.durationMonths * severity / previousSeverity));
    for (const event of [active, history]) {
      if (!event) continue;
      event.severity = severity;
      event.durationMonths = durationMonths;
      event.monthsRemaining = Math.max(0, durationMonths - elapsed);
    }
  }
  const action = state.actionHistory.find((candidate) => candidate.kind === 'event' && candidate.eventId === intervention.eventId);
  if (action?.kind === 'event') action.severity = severity;
  const residual = state.eventResiduals[intervention.eventId];
  if (residual) for (const sector of Object.keys(residual)) residual[sector as keyof typeof residual] = Number(((residual[sector as keyof typeof residual] ?? 0) * severity / previousSeverity).toFixed(3));
  return state;
}

export function createSnapshot(country: CountryState, label = 'Current World', source: SnapshotSource = 'manual', sourceEventId?: string, id?: string): ScenarioSnapshot {
  return { id: id ?? `snapshot-${country.month}-${country.nextId}`, label, month: country.month, rngState: 1, source, sourceEventId, country: clone(country) };
}

export function restoreSnapshot(snapshot: ScenarioSnapshot): CountryState {
  return clone(snapshot.country);
}

export function createBranch(snapshot: ScenarioSnapshot, label: string, id?: string): ScenarioBranch {
  return { id: id ?? `branch-${snapshot.id}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, label, baseSnapshot: clone(snapshot), createdMonth: snapshot.month };
}

export function duplicateBranch(branch: ScenarioBranch, id?: string): ScenarioBranch {
  return { ...clone(branch), id: id ?? `${branch.id}-copy`, label: `${branch.label} copy` };
}

export function deleteBranch(branches: Record<string, ScenarioBranch>, branchId: string) {
  const next = { ...branches };
  delete next[branchId];
  return next;
}

export function applyIntervention(snapshot: ScenarioSnapshot, intervention: ScenarioIntervention): CountryState {
  const state = restoreSnapshot(snapshot);
  if (intervention.kind === 'event') return removeEvent(state, intervention);
  if (intervention.kind === 'eventSeverity') return changeEventSeverity(state, intervention);
  if (intervention.kind === 'policy') return changePolicy(state, intervention.key, intervention.value);
  const sector = state.sectors[REGION_SECTOR[intervention.region]];
  const repairTo = Math.max(0, Math.min(100, Number.isFinite(intervention.repairTo) ? intervention.repairTo : 100));
  sector.capacity = Math.max(sector.capacity, repairTo);
  sector.health = Math.max(sector.health, repairTo);
  sector.output = Math.max(sector.output, repairTo);
  state.regions[intervention.region] = { ...state.regions[intervention.region], health: sector.health, productivity: sector.output };
  return changePolicy(state, 'emergencySpending', intervention.emergencySpending);
}

function interventionLabel(snapshot: ScenarioSnapshot, intervention: ScenarioIntervention) {
  if (intervention.kind === 'event') {
    const event = snapshot.country.eventHistory.find((candidate) => eventMatches(candidate, intervention));
    return `${intervention.action === 'prevent' ? 'Prevent' : 'Without'} ${event ? EVENT_LABEL[event.type] : 'Shock'}`;
  }
  if (intervention.kind === 'eventSeverity') return `${intervention.severity.toFixed(1)}× ${EVENT_LABEL[snapshot.country.eventHistory.find((event) => event.id === intervention.eventId)?.type ?? 'flood']}`;
  if (intervention.kind === 'policy') return `${POLICY_LABEL[intervention.key]} · ${intervention.value}`;
  return 'Emergency Relief';
}

function replayRecordedActions(country: CountryState, actions: SimulationAction[], horizonMonth: number, signal?: AbortSignal): CountryState {
  let next = clone(country);
  for (const action of actions) {
    throwIfAborted(signal);
    if (next.month >= horizonMonth) break;
    if (action.month > horizonMonth) break;
    if (next.month < action.month) next = advanceMonths(next, Math.min(action.month - next.month, horizonMonth - next.month));
    if (next.month >= horizonMonth) break;
    if (action.kind === 'advance') {
      const count = Math.min(action.months, horizonMonth - next.month);
      if (count > 0) next = advanceMonths(next, count);
    } else if (action.kind === 'policy') {
      next = changePolicy(next, action.key, action.value);
    } else {
      // Future events are replayed with the same semantic inputs. Keeping nextId monotonic
      // makes their generated IDs stable across baseline and counterfactual branches.
      next = triggerEventAction(next, action.type, action.region, action.severity);
    }
  }
  throwIfAborted(signal);
  if (next.month < horizonMonth) next = advanceMonths(next, horizonMonth - next.month);
  return next;
}

function run(label: string, snapshotId: string, country: CountryState, months: number, replayActions: SimulationAction[] = [], signal?: AbortSignal): ScenarioRunResult {
  throwIfAborted(signal);
  const startState = clone(country);
  const horizonMonth = country.month + months;
  const finalState = replayActions.length ? replayRecordedActions(country, replayActions, horizonMonth, signal) : advanceMonths(country, months);
  throwIfAborted(signal);
  return { id: `${snapshotId}-${months}`, label, snapshotId, rngState: 1, monthsSimulated: months, startState, finalState, history: clone(finalState.history), causalHistory: clone(finalState.causalHistory) };
}

function contributorRoot(contributor: CausalContributor) {
  return contributor.roots.find((root) => root.startsWith('event:') || root.startsWith('policy:')) ?? `${contributor.sourceType}:${contributor.sourceId}`;
}

function causalTotals(result: ScenarioRunResult, metric: MetricKey) {
  const totals = new Map<string, { effect: number; chains: string[][]; descriptions: string[] }>();
  for (const month of result.causalHistory) for (const change of month.metricChanges) {
    if (change.metric !== metric) continue;
    for (const contributor of change.contributors) {
      const root = contributorRoot(contributor);
      const value = totals.get(root) ?? { effect: 0, chains: [], descriptions: [] };
      value.effect += contributor.effect;
      value.chains.push([...contributor.chain]);
      if (!value.descriptions.includes(contributor.description)) value.descriptions.push(contributor.description);
      totals.set(root, value);
    }
  }
  return totals;
}

function causalDifferences(baseline: ScenarioRunResult, counterfactual: ScenarioRunResult, signal?: AbortSignal) {
  const differences: ScenarioCausalDifference[] = [];
  for (const metric of METRICS) {
    throwIfAborted(signal);
    const base = causalTotals(baseline, metric);
    const alternate = causalTotals(counterfactual, metric);
    const roots = new Set([...base.keys(), ...alternate.keys()]);
    for (const root of roots) {
      const a = base.get(root); const b = alternate.get(root);
      const baselineEffect = Number((a?.effect ?? 0).toFixed(3));
      const counterfactualEffect = Number((b?.effect ?? 0).toFixed(3));
      const difference = Number((counterfactualEffect - baselineEffect).toFixed(3));
      if (Math.abs(difference) < 0.01) continue;
      differences.push({ metric, root, baselineEffect, counterfactualEffect, difference, baselineChains: a?.chains ?? [], counterfactualChains: b?.chains ?? [], descriptions: [...new Set([...(a?.descriptions ?? []), ...(b?.descriptions ?? [])])] });
    }
  }
  return differences.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
}

function divergenceMonth(snapshot: ScenarioSnapshot, baseline: ScenarioRunResult, counterfactual: ScenarioRunResult, months: number) {
  const basePoints = new Map(baseline.history.map((point) => [point.month, point]));
  const alternatePoints = new Map(counterfactual.history.map((point) => [point.month, point]));
  for (let month = snapshot.month; month <= snapshot.month + months; month += 1) {
    const base = month === snapshot.month ? snapshot.country.metrics : basePoints.get(month);
    const alternate = month === snapshot.month ? snapshot.country.metrics : alternatePoints.get(month);
    if (!base || !alternate) continue;
    if (METRICS.some((metric) => Math.abs(base[metric] - alternate[metric]) >= 0.01)) return month;
  }
  return null;
}

export function runCounterfactual(options: RunCounterfactualOptions): ScenarioComparisonResult {
  throwIfAborted(options.signal);
  const months = Math.max(0, Math.min(60, Math.floor(Number.isFinite(options.months) ? options.months : 0)));
  const id = options.id ?? `comparison-${options.baseSnapshot.id}-${months}`;
  const alternate = applyIntervention(options.baseSnapshot, options.intervention);
  const replayActions = options.replayActions ?? [];
  throwIfAborted(options.signal);
  const baseline = run(options.baselineLabel ?? 'Current World', `${id}-baseline`, restoreSnapshot(options.baseSnapshot), months, replayActions, options.signal);
  const counterfactual = run(options.counterfactualLabel ?? interventionLabel(options.baseSnapshot, options.intervention), `${id}-counterfactual`, alternate, months, replayActions, options.signal);
  const metricDifferences = {} as Record<MetricKey, ScenarioMetricDifference>;
  for (const metric of METRICS) {
    throwIfAborted(options.signal);
    const base = baseline.finalState.metrics[metric];
    const counter = counterfactual.finalState.metrics[metric];
    metricDifferences[metric] = { baseline: base, counterfactual: counter, difference: Number((counter - base).toFixed(2)), percentDifference: base ? Number((((counter - base) / Math.abs(base)) * 100).toFixed(2)) : 0 };
  }
  const causal = causalDifferences(baseline, counterfactual, options.signal);
  throwIfAborted(options.signal);
  const divergence = divergenceMonth(options.baseSnapshot, baseline, counterfactual, months);
  const changed = Object.values(metricDifferences).some((difference) => Math.abs(difference.difference) >= 0.01);
  const largest = [...Object.entries(metricDifferences)].sort((a, b) => Math.abs(b[1].difference) - Math.abs(a[1].difference))[0];
  const summary = changed ? `${interventionLabel(options.baseSnapshot, options.intervention)} changes ${largest[0]} by ${largest[1].difference >= 0 ? '+' : ''}${largest[1].difference.toFixed(2)} after ${months} months.` : 'The intervention does not change the measured outcome over this horizon.';
  return { id, baselineId: baseline.id, counterfactualId: counterfactual.id, baseSnapshotId: options.baseSnapshot.id, intervention: clone(options.intervention), monthsSimulated: months, baseline, counterfactual, metricDifferences, causalDifferences: causal, divergenceMonth: divergence, timelinesDiverged: changed, summary };
}

export { interventionLabel };
