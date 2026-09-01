import { advanceMonths as advance, changePolicy as setPolicy, triggerEvent as addEvent } from '../economy/engine.ts';
import { createSnapshot as snapshotFromState, runCounterfactual as compare } from '../economy/counterfactual.ts';
import { initialCountryState } from '../economy/initialState.ts';
import { selectMetricExplanation, selectRegionInspector, selectTimeline } from '../economy/visualState.ts';
import type { CountryState, EventType, MetricKey, PolicyKey, RegionId, RunCounterfactualOptions, ScenarioComparisonResult, ScenarioIntervention, ScenarioSnapshot, SectorId } from '../economy/types.ts';

export const METRIC_KEYS: MetricKey[] = ['gdp', 'inflation', 'unemployment', 'debtPct', 'foodIndex', 'energyIndex', 'industrialOutput', 'importsIndex', 'exportsIndex', 'confidence'];
export const POLICY_LIMITS: Record<PolicyKey, readonly [number, number]> = {
  interestRate: [0, 20], incomeTax: [0, 60], corporateTax: [0, 60], governmentSpending: [0, 100], tariffRate: [0, 50], emergencySpending: [0, 100],
};
export const EVENT_REGION: Record<EventType, RegionId> = {
  flood: 'port', drought: 'farmbelt', war: 'industrial', oil_shock: 'energy', banking_crisis: 'capital', productivity_boom: 'industrial',
};

export type AgentEventType = Exclude<EventType, 'war'> | 'trade_conflict';
export const toAgentEventType = (type: EventType): AgentEventType => type === 'war' ? 'trade_conflict' : type;

function externalizeEvent<T extends { type: EventType }>(event: T) {
  return { ...structuredClone(event), type: toAgentEventType(event.type) };
}

const finite = (value: number, name: string) => {
  if (!Number.isFinite(value)) throw new Error(`${name} must be a finite number.`);
  return value;
};

const boundedInteger = (value: number, min: number, max: number, name: string) => {
  finite(value, name);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer from ${min} to ${max}.`);
  return value;
};

export function summarizeCountryState(country: CountryState) {
  const warnings = [
    country.metrics.inflation >= 6 ? `Inflation is high at ${country.metrics.inflation}%.` : null,
    country.metrics.unemployment >= 8 ? `Unemployment is high at ${country.metrics.unemployment}%.` : null,
    country.metrics.debtPct >= 90 ? `Public debt is high at ${country.metrics.debtPct}% of GDP.` : null,
    country.metrics.foodIndex < 85 ? `Food supply is disrupted at index ${country.metrics.foodIndex}.` : null,
    country.metrics.energyIndex < 85 ? `Energy supply is disrupted at index ${country.metrics.energyIndex}.` : null,
    country.metrics.importsIndex < 85 ? `Imports are disrupted at index ${country.metrics.importsIndex}.` : null,
  ].filter((warning): warning is string => Boolean(warning));
  return {
    month: country.month,
    year: Math.floor((country.month - 1) / 12) + 1,
    metrics: structuredClone(country.metrics),
    policies: structuredClone(country.policies),
    activeEvents: country.activeEvents.map(externalizeEvent),
    warnings,
  };
}

export function getMetricHistory(country: CountryState, metric?: MetricKey, months = 12) {
  const count = boundedInteger(months, 1, 60, 'months');
  const history = country.history.slice(-count);
  if (!metric) return structuredClone(history);
  return { metric, currentValue: country.metrics[metric], points: history.map((point) => ({ month: point.month, value: point[metric] })) };
}

const normalizeEventId = (value: string) => value.startsWith('event:') ? value.slice('event:'.length) : value;

export function getEventHistory(country: CountryState) {
  return selectTimeline(country)
    .filter((item) => item.kind === 'event' || item.kind === 'policy')
    .map(({ id, month, kind, title, detail, causes }) => {
      const eventRoot = causes.find((cause) => cause.startsWith('event:'));
      const eventId = eventRoot ? normalizeEventId(eventRoot) : undefined;
      const event = eventId ? country.eventHistory.find((candidate) => candidate.id === eventId) : undefined;
      return {
        timelineId: id,
        month,
        kind,
        title,
        detail,
        causes,
        ...(event ? {
          eventId: event.id,
          eventType: toAgentEventType(event.type),
          region: event.region,
          severity: event.severity,
          startedMonth: event.startedMonth,
          durationMonths: event.durationMonths,
          monthsRemaining: country.activeEvents.find((candidate) => candidate.id === event.id)?.monthsRemaining ?? 0,
        } : {}),
      };
    })
    .slice(0, 30);
}

export function getCausalHistory(country: CountryState, metric?: MetricKey, months = 12) {
  if (!metric) return structuredClone(country.causalHistory.slice(-boundedInteger(months, 1, 36, 'months')));
  const explanation = selectMetricExplanation(country, metric);
  const earliestMonth = Math.max(1, country.month - boundedInteger(months, 1, 36, 'months') + 1);
  return {
    metric,
    currentValue: country.metrics[metric],
    month: explanation.month,
    summary: explanation.month >= earliestMonth ? explanation.summary : `No recorded ${metric} change in the requested window.`,
    contributors: explanation.month < earliestMonth ? [] : explanation.contributors.map((contributor) => {
      const eventRoot = contributor.roots.find((root) => root.startsWith('event:'));
      const eventId = contributor.sourceType === 'event'
        ? normalizeEventId(contributor.sourceId)
        : eventRoot ? normalizeEventId(eventRoot) : undefined;
      return {
        sourceType: contributor.sourceType,
        sourceId: contributor.sourceType === 'event' && eventId ? eventId : contributor.sourceId,
        ...(eventId ? { eventId } : {}),
        contribution: contributor.effect,
        description: contributor.description,
        chain: contributor.path,
      };
    }),
  };
}

export const getCountryState = (country: CountryState) => structuredClone(country);
export function inspectRegion(country: CountryState, region: RegionId) {
  const result = selectRegionInspector(country, region);
  return { ...result, recentEvents: result.recentEvents.map(externalizeEvent) };
}
export const inspectSector = (country: CountryState, sector: SectorId) => structuredClone(country.sectors[sector]);

export function changePolicy(country: CountryState, key: PolicyKey, value: number) {
  finite(value, 'value');
  const [min, max] = POLICY_LIMITS[key];
  if (value < min || value > max) throw new Error(`${key} must be from ${min} to ${max}.`);
  return setPolicy(country, key, value);
}

export function triggerEvent(country: CountryState, type: EventType, region: RegionId, severity = 1) {
  finite(severity, 'severity');
  if (region !== EVENT_REGION[type]) throw new Error(`${type} can only occur in ${EVENT_REGION[type]}.`);
  if (severity < 0.25 || severity > 2) throw new Error('severity must be from 0.25 to 2.');
  return addEvent(country, type, region, severity);
}

export const provideEmergencyResponse = (country: CountryState, spending: number) => changePolicy(country, 'emergencySpending', spending);
export const advanceMonths = (country: CountryState, months: number) => advance(country, boundedInteger(months, 1, 24, 'months'));
export const createSnapshot = (country: CountryState, label = 'Current World', source: ScenarioSnapshot['source'] = 'manual', sourceEventId?: string, id?: string) => snapshotFromState(country, label, source, sourceEventId, id);

export function runCounterfactual(snapshot: ScenarioSnapshot, intervention: ScenarioIntervention, months: number, options?: Omit<RunCounterfactualOptions, 'baseSnapshot' | 'intervention' | 'months'>) {
  return compare({ baseSnapshot: snapshot, intervention, months: boundedInteger(months, 1, 36, 'months'), ...options });
}

export const compareScenarios = runCounterfactual;
export const highlightRegion = (region: RegionId) => region;
export const showMetric = (metric: MetricKey) => metric;
export const showCausalChain = (metric: MetricKey) => metric;

export interface CountryLabService {
  getCountryState: () => CountryState;
  getMetricHistory: (metric?: MetricKey, months?: number) => ReturnType<typeof getMetricHistory>;
  getEventHistory: () => ReturnType<typeof getEventHistory>;
  getCausalHistory: (metric?: MetricKey, months?: number) => ReturnType<typeof getCausalHistory>;
  inspectRegion: (region: RegionId) => ReturnType<typeof inspectRegion>;
  inspectSector: (sector: SectorId) => CountryState['sectors'][SectorId];
  changePolicy: (key: PolicyKey, value: number) => CountryState;
  triggerEvent: (type: EventType, region: RegionId, severity?: number) => CountryState;
  provideEmergencyResponse: (spending: number) => CountryState;
  advanceMonths: (months: number) => CountryState;
  createSnapshot: (label?: string, source?: ScenarioSnapshot['source'], sourceEventId?: string, id?: string) => ScenarioSnapshot;
  runCounterfactual: (snapshot: ScenarioSnapshot, intervention: ScenarioIntervention, months: number, options?: Omit<RunCounterfactualOptions, 'baseSnapshot' | 'intervention' | 'months'>) => ScenarioComparisonResult;
  compareScenarios: (snapshot: ScenarioSnapshot, intervention: ScenarioIntervention, months: number, options?: Omit<RunCounterfactualOptions, 'baseSnapshot' | 'intervention' | 'months'>) => ScenarioComparisonResult;
  highlightRegion: (region: RegionId) => RegionId;
  showMetric: (metric: MetricKey) => MetricKey;
  showCausalChain: (metric: MetricKey) => MetricKey;
}

export function createCountryLabService(seed: CountryState = initialCountryState): CountryLabService {
  let country = structuredClone(seed);
  return {
    getCountryState: () => getCountryState(country),
    getMetricHistory: (metric, months) => getMetricHistory(country, metric, months),
    getEventHistory: () => getEventHistory(country),
    getCausalHistory: (metric, months) => getCausalHistory(country, metric, months),
    inspectRegion: (region) => inspectRegion(country, region),
    inspectSector: (sector) => inspectSector(country, sector),
    changePolicy: (key, value) => { country = changePolicy(country, key, value); return getCountryState(country); },
    triggerEvent: (type, region, severity) => { country = triggerEvent(country, type, region, severity); return getCountryState(country); },
    provideEmergencyResponse: (spending) => { country = provideEmergencyResponse(country, spending); return getCountryState(country); },
    advanceMonths: (months) => { country = advanceMonths(country, months); return getCountryState(country); },
    createSnapshot: (label) => createSnapshot(country, label),
    runCounterfactual,
    compareScenarios,
    highlightRegion,
    showMetric,
    showCausalChain,
  };
}
