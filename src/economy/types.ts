export type RegionId = 'capital' | 'farmbelt' | 'industrial' | 'port' | 'energy';
export type EventType = 'flood' | 'drought' | 'war' | 'oil_shock' | 'banking_crisis' | 'productivity_boom';
export type SectorId = 'households' | 'agriculture' | 'manufacturing' | 'energy' | 'trade' | 'banking' | 'government' | 'central_bank';

export interface Metrics {
  gdp: number;
  inflation: number;
  unemployment: number;
  debtPct: number;
  foodIndex: number;
  energyIndex: number;
  industrialOutput: number;
  importsIndex: number;
  exportsIndex: number;
  confidence: number;
}

export type MetricKey = keyof Metrics;

export interface Policies {
  interestRate: number;
  incomeTax: number;
  corporateTax: number;
  governmentSpending: number;
  tariffRate: number;
  emergencySpending: number;
}

export type PolicyKey = keyof Policies;

export type SimulationAction =
  | { kind: 'policy'; month: number; key: PolicyKey; value: number }
  | { kind: 'event'; month: number; type: EventType; region: RegionId; severity: number; eventId: string }
  | { kind: 'advance'; month: number; months: number };

export interface SectorState {
  id: SectorId;
  name: string;
  capacity: number;
  output: number;
  health: number;
  causalRoots: string[];
}

export interface RegionState {
  id: RegionId;
  name: string;
  health: number;
  productivity: number;
}

export interface ActiveEvent {
  id: string;
  type: EventType;
  region: RegionId;
  severity: number;
  startedMonth: number;
  durationMonths: number;
  monthsRemaining: number;
}

export interface HistoryPoint extends Metrics {
  month: number;
}

export interface LogEntry {
  id: string;
  month: number;
  title: string;
  detail: string;
  causes?: string[];
}

export type CausalSourceType = 'event' | 'policy' | 'sector' | 'metric' | 'recovery' | 'system';
export interface CausalContributor {
  sourceType: CausalSourceType;
  sourceId: string;
  effect: number;
  description: string;
  roots: string[];
  chain: string[];
}

export interface SectorChange {
  id: string;
  sector: SectorId;
  field: 'capacity' | 'output' | 'health';
  from: number;
  to: number;
  delta: number;
  contributors: CausalContributor[];
}

export interface MetricChange {
  id: string;
  metric: MetricKey;
  from: number;
  to: number;
  delta: number;
  contributors: CausalContributor[];
}

export interface CausalMonthRecord {
  id: string;
  month: number;
  sectorChanges: SectorChange[];
  metricChanges: MetricChange[];
}

export interface CountryState {
  month: number;
  nextId: number;
  metrics: Metrics;
  policies: Policies;
  sectors: Record<SectorId, SectorState>;
  regions: Record<RegionId, RegionState>;
  activeEvents: ActiveEvent[];
  eventHistory: ActiveEvent[];
  history: HistoryPoint[];
  causalHistory: CausalMonthRecord[];
  metricRoots: Partial<Record<MetricKey, string[]>>;
  causalBranches: Record<string, string[]>;
  eventResiduals: Record<string, Partial<Record<SectorId, number>>>;
  actionHistory: SimulationAction[];
  log: LogEntry[];
}

export type SnapshotSource = 'initial' | 'manual' | 'event';

export interface ScenarioSnapshot {
  id: string;
  label: string;
  month: number;
  rngState: number;
  source: SnapshotSource;
  sourceEventId?: string;
  country: CountryState;
}

export type ScenarioIntervention =
  | { kind: 'event'; action: 'remove' | 'prevent'; eventId?: string; eventType?: EventType; region?: RegionId }
  | { kind: 'eventSeverity'; eventId: string; severity: number }
  | { kind: 'policy'; key: PolicyKey; value: number }
  | { kind: 'relief'; region: RegionId; emergencySpending: number; repairTo: number };

export interface ScenarioBranch {
  id: string;
  label: string;
  baseSnapshot: ScenarioSnapshot;
  intervention?: ScenarioIntervention;
  createdMonth: number;
}

export interface ScenarioRunResult {
  id: string;
  label: string;
  snapshotId: string;
  rngState: number;
  monthsSimulated: number;
  startState: CountryState;
  finalState: CountryState;
  history: HistoryPoint[];
  causalHistory: CausalMonthRecord[];
}

export interface ScenarioMetricDifference {
  baseline: number;
  counterfactual: number;
  difference: number;
  percentDifference: number;
}

export interface ScenarioCausalDifference {
  metric: MetricKey;
  root: string;
  baselineEffect: number;
  counterfactualEffect: number;
  difference: number;
  baselineChains: string[][];
  counterfactualChains: string[][];
  descriptions: string[];
}

export interface ScenarioComparisonResult {
  id: string;
  baselineId: string;
  counterfactualId: string;
  baseSnapshotId: string;
  intervention: ScenarioIntervention;
  monthsSimulated: number;
  baseline: ScenarioRunResult;
  counterfactual: ScenarioRunResult;
  metricDifferences: Record<MetricKey, ScenarioMetricDifference>;
  causalDifferences: ScenarioCausalDifference[];
  divergenceMonth: number | null;
  timelinesDiverged: boolean;
  summary: string;
}

export interface RunCounterfactualOptions {
  baseSnapshot: ScenarioSnapshot;
  intervention: ScenarioIntervention;
  months: number;
  id?: string;
  baselineLabel?: string;
  counterfactualLabel?: string;
  replayActions?: SimulationAction[];
  signal?: AbortSignal;
}

export interface CounterfactualResult {
  label: string;
  months: number;
  start: Metrics;
  baseline: Metrics;
  end: Metrics;
  delta: Partial<Record<MetricKey, number>>;
}
