import { create } from 'zustand';
import { runScenarioWithCheckpoints, economicScenarios, findScenario } from '../economy/scenarios.ts';
import { createBranch as buildBranch, deleteBranch as removeBranch, duplicateBranch as copyBranch, restoreSnapshot as restoreScenarioSnapshot } from '../economy/counterfactual.ts';
import { initialCountryState } from '../economy/initialState.ts';
import { EVENT_PRESENTATION } from '../economy/visualState.ts';
import { advanceMonths as advanceCountry, changePolicy as changeCountryPolicy, createSnapshot as buildSnapshot, runCounterfactual as runScenarioComparison, triggerEvent as triggerCountryEvent } from '../application/countryLabService.ts';
import type { CountryState, EventType, PolicyKey, RegionId, ScenarioBranch, ScenarioComparisonResult, ScenarioIntervention, ScenarioSnapshot, SimulationAction } from '../economy/types';

export interface ActionNotice {
  id: number;
  message: string;
  detail?: string;
}

type ViewMode = 'live' | 'alternate';

interface GameStore {
  country: CountryState;
  selectedRegion: RegionId | null;
  highlightedRegion: RegionId | null;
  highlightedMetric: keyof CountryState['metrics'] | null;
  selectedTimelineId: string | null;
  snapshot: ScenarioSnapshot | null;
  snapshots: Record<string, ScenarioSnapshot>;
  branches: Record<string, ScenarioBranch>;
  comparisons: Record<string, ScenarioComparisonResult>;
  activeComparisonId: string | null;
  baseSnapshotId: string;
  activeScenarioId: string | null;
  viewMode: ViewMode;
  simulationStatus: 'paused' | 'running';
  notice: ActionNotice | null;
  selectRegion: (region: RegionId | null) => void;
  highlightRegion: (region: RegionId | null) => void;
  highlightMetric: (metric: keyof CountryState['metrics'] | null) => void;
  selectTimelineItem: (id: string | null, metric?: keyof CountryState['metrics'], region?: RegionId) => void;
  setPolicy: (key: PolicyKey, value: number) => void;
  addEvent: (type: EventType, region: RegionId, severity?: number) => void;
  advance: (months?: number) => void;
  reset: () => void;
  loadScenario: (scenarioId: string) => boolean;
  restartScenario: () => boolean;
  returnToBaseline: () => void;
  dismissNotice: () => void;
  createSnapshot: () => void;
  restoreSnapshot: () => void;
  captureScenarioSnapshot: (label?: string) => ScenarioSnapshot;
  createBranch: (label: string, snapshotId?: string) => string;
  duplicateBranch: (branchId: string) => string | null;
  deleteBranch: (branchId: string) => void;
  runScenario: (branchId: string, intervention: ScenarioIntervention, months: number, labels?: { baseline?: string; counterfactual?: string }, options?: { signal?: AbortSignal }) => ScenarioComparisonResult | null;
  runExperiment: (intervention: ScenarioIntervention, months: number, snapshotId?: string, labels?: { baseline?: string; counterfactual?: string }, options?: { signal?: AbortSignal }) => ScenarioComparisonResult | null;
  showComparison: (comparisonId: string) => boolean;
  proveIt: (eventId: string, months?: number) => ScenarioComparisonResult | null;
  clearComparison: () => void;
  clearCounterfactuals: () => void;
}

const initialSnapshot = buildSnapshot(initialCountryState, 'Baseline World', 'initial', undefined, 'snapshot-initial');
let noticeId = 0;

function nextId(prefix: string, values: Record<string, unknown>) {
  let index = Object.keys(values).length + 1;
  while (values[`${prefix}-${index}`]) index += 1;
  return `${prefix}-${index}`;
}

function notice(message: string, detail?: string): ActionNotice {
  noticeId += 1;
  return { id: noticeId, message, detail };
}


function replayActionsFromLive(source: ScenarioSnapshot, live: CountryState): SimulationAction[] {
  const prefix = source.country.actionHistory;
  if (prefix.length > live.actionHistory.length) throw new Error(`Snapshot '${source.id}' is not on the current live timeline. Capture a new snapshot before running this experiment.`);
  const sameLineage = prefix.every((action, index) => JSON.stringify(action) === JSON.stringify(live.actionHistory[index]));
  if (!sameLineage) throw new Error(`Snapshot '${source.id}' is stale or belongs to a different timeline. Capture a new snapshot before running this experiment.`);
  return structuredClone(live.actionHistory.slice(prefix.length));
}

function createScenarioResult(scenarioId: string) {
  const scenario = findScenario(scenarioId);
  if (!scenario) return null;
  const result = runScenarioWithCheckpoints(scenario, initialCountryState);
  return { scenario, ...result };
}

export const useGameStore = create<GameStore>((set, get) => ({
  country: structuredClone(initialCountryState),
  selectedRegion: null,
  highlightedRegion: null,
  highlightedMetric: null,
  selectedTimelineId: null,
  snapshot: initialSnapshot,
  snapshots: { [initialSnapshot.id]: initialSnapshot },
  branches: {},
  comparisons: {},
  activeComparisonId: null,
  baseSnapshotId: initialSnapshot.id,
  activeScenarioId: null,
  viewMode: 'live',
  simulationStatus: 'paused',
  notice: null,
  selectRegion: (region) => set({ selectedRegion: region, highlightedRegion: region }),
  highlightRegion: (region) => set({ highlightedRegion: region }),
  highlightMetric: (metric) => set({ highlightedMetric: metric }),
  selectTimelineItem: (id, metric, region) => set({ selectedTimelineId: id, highlightedMetric: metric ?? null, highlightedRegion: region ?? null, selectedRegion: region ?? null }),
  setPolicy: (key, value) => set((state) => {
    const previous = state.country.policies[key];
    const country = changeCountryPolicy(state.country, key, value);
    return { country, notice: previous === country.policies[key] ? state.notice : notice(`${key === 'interestRate' ? 'Central Bank raised rates' : 'Policy updated'} ${previous} → ${country.policies[key]}`, 'The live world is ready for another month.') };
  }),
  addEvent: (type, region, severity = 1) => set((state) => {
    const country = triggerCountryEvent(state.country, type, region, severity);
    const event = country.eventHistory.at(-1);
    if (!event) return { country };
    const label = EVENT_PRESENTATION[type].label;
    const scenarioSnapshot = buildSnapshot(country, `${label} in ${country.regions[region].name}`, 'event', event.id, `snapshot-event-${event.id}`);
    return {
      country,
      selectedRegion: region,
      highlightedRegion: region,
      baseSnapshotId: scenarioSnapshot.id,
      snapshots: { ...state.snapshots, [scenarioSnapshot.id]: scenarioSnapshot },
      notice: notice(`${label} hits ${country.regions[region].name}`, 'Watch the map, then follow the causal chain in the timeline.'),
    };
  }),
  advance: (months = 1) => set((state) => {
    const safeMonths = Math.max(1, Math.round(months));
    return { country: advanceCountry(state.country, safeMonths), simulationStatus: 'paused', notice: notice(`${safeMonths} month${safeMonths === 1 ? '' : 's'} simulated`, 'The timeline and metrics now include the new consequences.') };
  }),
  reset: () => set({
    country: structuredClone(initialCountryState),
    selectedRegion: null,
    highlightedRegion: null,
    highlightedMetric: null,
    selectedTimelineId: null,
    snapshot: initialSnapshot,
    snapshots: { [initialSnapshot.id]: initialSnapshot },
    branches: {},
    comparisons: {},
    activeComparisonId: null,
    baseSnapshotId: initialSnapshot.id,
    activeScenarioId: null,
    viewMode: 'live',
    simulationStatus: 'paused',
    notice: notice('Returned to the baseline world', 'All live shocks, policies, and counterfactuals were cleared.'),
  }),
  loadScenario: (scenarioId) => {
    const result = createScenarioResult(scenarioId);
    if (!result) return false;
    const eventSnapshots = Object.fromEntries(result.eventCheckpoints.map(({ eventId, country }) => {
      const event = country.eventHistory.find((candidate) => candidate.id === eventId);
      const label = event ? `${EVENT_PRESENTATION[event.type].label} in ${country.regions[event.region].name}` : `${result.scenario.title} · event checkpoint`;
      const scenarioSnapshot = buildSnapshot(country, label, 'event', eventId, `snapshot-event-${eventId}`);
      return [scenarioSnapshot.id, scenarioSnapshot];
    }));
    const latestEvent = result.country.eventHistory.at(-1);
    const latestEventSnapshot = latestEvent ? eventSnapshots[`snapshot-event-${latestEvent.id}`] : undefined;
    set({
      country: result.country,
      selectedRegion: latestEvent?.region ?? null,
      highlightedRegion: latestEvent?.region ?? null,
      highlightedMetric: null,
      selectedTimelineId: null,
      snapshots: { [initialSnapshot.id]: initialSnapshot, ...eventSnapshots },
      snapshot: initialSnapshot,
      baseSnapshotId: latestEventSnapshot?.id ?? initialSnapshot.id,
      branches: {},
      comparisons: {},
      activeComparisonId: null,
      activeScenarioId: result.scenario.id,
      viewMode: 'live',
      simulationStatus: 'paused',
      notice: notice(`${result.scenario.title} loaded`, result.scenario.question),
    });
    return true;
  },
  restartScenario: () => {
    const scenarioId = get().activeScenarioId;
    return scenarioId ? get().loadScenario(scenarioId) : (get().reset(), true);
  },
  returnToBaseline: () => get().reset(),
  dismissNotice: () => set({ notice: null }),
  createSnapshot: () => set((state) => {
    const id = nextId('snapshot-manual', state.snapshots);
    const scenarioSnapshot = buildSnapshot(state.country, 'Saved live world', 'manual', undefined, id);
    return { snapshot: scenarioSnapshot, baseSnapshotId: scenarioSnapshot.id, snapshots: { ...state.snapshots, [id]: scenarioSnapshot }, notice: notice('Live world snapshot saved') };
  }),
  restoreSnapshot: () => {
    const scenarioSnapshot = get().snapshot;
    if (scenarioSnapshot) set({ country: restoreScenarioSnapshot(scenarioSnapshot), baseSnapshotId: scenarioSnapshot.id, viewMode: 'live', activeComparisonId: null, notice: notice('Saved world restored') });
  },
  captureScenarioSnapshot: (label = 'Saved live world') => {
    const state = get();
    const id = nextId('snapshot-manual', state.snapshots);
    const scenarioSnapshot = buildSnapshot(state.country, label, 'manual', undefined, id);
    set({ snapshot: scenarioSnapshot, baseSnapshotId: id, snapshots: { ...state.snapshots, [id]: scenarioSnapshot }, notice: notice('Scenario snapshot captured') });
    return scenarioSnapshot;
  },
  createBranch: (label, snapshotId) => {
    const state = get();
    const source = state.snapshots[snapshotId ?? state.baseSnapshotId] ?? state.snapshot;
    if (!source) return '';
    const branch = buildBranch(source, label, nextId('branch', state.branches));
    set({ branches: { ...state.branches, [branch.id]: branch }, notice: notice('Alternate world created', branch.label) });
    return branch.id;
  },
  duplicateBranch: (branchId) => {
    const state = get();
    const source = state.branches[branchId];
    if (!source) return null;
    const branch = copyBranch(source, nextId('branch', state.branches));
    set({ branches: { ...state.branches, [branch.id]: branch }, notice: notice('Alternate world duplicated') });
    return branch.id;
  },
  deleteBranch: (branchId) => set((state) => ({ branches: removeBranch(state.branches, branchId) })),
  runScenario: (branchId, intervention, months, labels, options) => {
    const state = get();
    const branch = state.branches[branchId];
    if (!branch) return null;
    const comparison = runScenarioComparison(branch.baseSnapshot, intervention, months, { id: nextId('comparison', state.comparisons), baselineLabel: labels?.baseline, counterfactualLabel: labels?.counterfactual, replayActions: replayActionsFromLive(branch.baseSnapshot, state.country), signal: options?.signal });
    set({ branches: { ...state.branches, [branchId]: { ...branch, intervention } }, comparisons: { ...state.comparisons, [comparison.id]: comparison }, activeComparisonId: comparison.id, viewMode: 'alternate', notice: notice('Alternate world created', 'Compare it with LIVE WORLD below.') });
    return comparison;
  },
  runExperiment: (intervention, months, snapshotId, labels, options) => {
    const state = get();
    const source = state.snapshots[snapshotId ?? state.baseSnapshotId] ?? state.snapshot;
    if (!source) return null;
    const branchId = nextId('branch', state.branches);
    const branch = buildBranch(source, labels?.counterfactual ?? 'Alternate world', branchId);
    const comparison = runScenarioComparison(branch.baseSnapshot, intervention, months, { id: nextId('comparison', state.comparisons), baselineLabel: labels?.baseline, counterfactualLabel: labels?.counterfactual, replayActions: replayActionsFromLive(branch.baseSnapshot, state.country), signal: options?.signal });
    set({ branches: { ...state.branches, [branch.id]: { ...branch, intervention } }, comparisons: { ...state.comparisons, [comparison.id]: comparison }, activeComparisonId: comparison.id, viewMode: 'alternate', notice: notice('Alternate world created', 'The live country is unchanged.') });
    return comparison;
  },
  showComparison: (comparisonId) => {
    const comparison = get().comparisons[comparisonId];
    if (!comparison) return false;
    set({ activeComparisonId: comparisonId, viewMode: 'alternate', notice: notice('Comparison opened', 'The alternate world is visible beside the live country.') });
    return true;
  },
  proveIt: (eventId, months = 12) => {
    const state = get();
    const source = Object.values(state.snapshots).find((candidate) => candidate.sourceEventId === eventId) ?? state.snapshot;
    if (!source) return null;
    const event = source.country.eventHistory.find((candidate) => candidate.id === eventId);
    const intervention: ScenarioIntervention = { kind: 'event', action: 'remove', eventId, eventType: event?.type, region: event?.region };
    return get().runExperiment(intervention, months, source.id, { baseline: source.label, counterfactual: `Without ${event ? EVENT_PRESENTATION[event.type].label : 'shock'}` });
  },
  clearComparison: () => set({ activeComparisonId: null, viewMode: 'live', notice: notice('Back to LIVE WORLD') }),
  clearCounterfactuals: () => set({ branches: {}, comparisons: {}, activeComparisonId: null, viewMode: 'live', notice: notice('Counterfactuals cleared') }),
}));

export { economicScenarios };
