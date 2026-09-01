import type {
  ActiveEvent,
  CausalContributor,
  CountryState,
  EventType,
  MetricKey,
  RegionId,
  SectorId,
} from './types';

export const METRIC_PRESENTATION: ReadonlyArray<{
  key: MetricKey;
  label: string;
  shortLabel: string;
  suffix: string;
  higherIsBetter: boolean;
}> = [
  { key: 'gdp', label: 'GDP index', shortLabel: 'GDP', suffix: '', higherIsBetter: true },
  { key: 'inflation', label: 'Inflation', shortLabel: 'CPI', suffix: '%', higherIsBetter: false },
  { key: 'unemployment', label: 'Unemployment', shortLabel: 'Jobs', suffix: '%', higherIsBetter: false },
  { key: 'debtPct', label: 'Debt / GDP', shortLabel: 'Debt', suffix: '%', higherIsBetter: false },
  { key: 'foodIndex', label: 'Food supply', shortLabel: 'Food', suffix: '', higherIsBetter: true },
  { key: 'energyIndex', label: 'Energy supply', shortLabel: 'Energy', suffix: '', higherIsBetter: true },
  { key: 'importsIndex', label: 'Imports index', shortLabel: 'Imports', suffix: '', higherIsBetter: true },
  { key: 'exportsIndex', label: 'Exports index', shortLabel: 'Exports', suffix: '', higherIsBetter: true },
] as const;

export const EVENT_PRESENTATION: Record<EventType, { label: string; color: number; cssColor: string; tone: 'negative' | 'positive' }> = {
  flood: { label: 'Flood', color: 0x2d8fd2, cssColor: '#47a9e5', tone: 'negative' },
  drought: { label: 'Drought', color: 0xc78532, cssColor: '#d89b49', tone: 'negative' },
  war: { label: 'Conflict', color: 0xc64b4f, cssColor: '#e36767', tone: 'negative' },
  oil_shock: { label: 'Energy shock', color: 0xe0a646, cssColor: '#e7b95c', tone: 'negative' },
  banking_crisis: { label: 'Banking crisis', color: 0x944f79, cssColor: '#c47aa3', tone: 'negative' },
  productivity_boom: { label: 'Productivity boom', color: 0x4baf84, cssColor: '#59c994', tone: 'positive' },
};

export type SignalLevel = 'stable' | 'watch' | 'warning' | 'critical' | 'positive';

export interface MetricCardState {
  key: MetricKey;
  label: string;
  shortLabel: string;
  suffix: string;
  value: number;
  delta: number;
  trend: 'up' | 'down' | 'flat';
  trendIsGood: boolean;
  level: SignalLevel;
  series: number[];
}

export interface RegionVisualState {
  id: RegionId;
  health: number;
  productivity: number;
  damage: number;
  activity: number;
  recovery: number;
  status: 'stable' | 'disrupted' | 'recovering' | 'expanding';
  events: Array<{ id: string; type: EventType; label: string; intensity: number; active: boolean; monthsRemaining: number }>;
}

export interface WorldVisualState {
  month: number;
  regions: Record<RegionId, RegionVisualState>;
  activity: {
    roadFreight: number;
    shipping: number;
    factory: number;
    power: number;
  };
}

export interface MetricExplanation {
  metric: MetricKey;
  label: string;
  month: number;
  from: number;
  to: number;
  delta: number;
  summary: string;
  contributors: Array<CausalContributor & { path: string[] }>;
}

export interface TimelineItem {
  id: string;
  month: number;
  kind: 'event' | 'policy' | 'consequence' | 'system';
  title: string;
  detail: string;
  causes: string[];
  metric?: MetricKey;
  delta?: number;
}

export interface RegionInspectorState {
  id: RegionId;
  health: number;
  productivity: number;
  damage: number;
  capacity: number;
  status: RegionVisualState['status'];
  activeEffects: RegionVisualState['events'];
  recentEvents: ActiveEvent[];
  metrics: Array<{ key: MetricKey; label: string; value: number }>;
  sectors: SectorId[];
}

const regionIds: RegionId[] = ['capital', 'farmbelt', 'industrial', 'port', 'energy'];
const regionSectors: Record<RegionId, SectorId[]> = {
  capital: ['banking', 'government', 'central_bank', 'households'],
  farmbelt: ['agriculture'],
  industrial: ['manufacturing'],
  port: ['trade'],
  energy: ['energy'],
};
const regionMetrics: Record<RegionId, MetricKey[]> = {
  capital: ['gdp', 'unemployment', 'confidence'],
  farmbelt: ['foodIndex', 'importsIndex'],
  industrial: ['industrialOutput', 'exportsIndex', 'gdp'],
  port: ['importsIndex', 'exportsIndex'],
  energy: ['energyIndex', 'industrialOutput'],
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number, digits = 1) => Number(value.toFixed(digits));

function metricLevel(key: MetricKey, value: number): SignalLevel {
  if (key === 'inflation') return value >= 10 ? 'critical' : value >= 6 ? 'warning' : value >= 4 ? 'watch' : 'stable';
  if (key === 'unemployment') return value >= 14 ? 'critical' : value >= 9 ? 'warning' : value >= 7 ? 'watch' : 'stable';
  if (key === 'debtPct') return value >= 100 ? 'critical' : value >= 80 ? 'warning' : value >= 65 ? 'watch' : 'stable';
  if (key === 'gdp') return value <= 70 ? 'critical' : value <= 85 ? 'warning' : value <= 95 ? 'watch' : value >= 108 ? 'positive' : 'stable';
  if (['foodIndex', 'energyIndex', 'importsIndex', 'exportsIndex', 'industrialOutput', 'confidence'].includes(key)) {
    return value <= 55 ? 'critical' : value <= 75 ? 'warning' : value <= 90 ? 'watch' : value >= 110 ? 'positive' : 'stable';
  }
  return 'stable';
}

export function selectMetricCards(country: CountryState): MetricCardState[] {
  const history = [...country.history];
  if (!history.length || history.at(-1)?.month !== country.month) history.push({ month: country.month, ...country.metrics });
  return METRIC_PRESENTATION.map((definition) => {
    const change = country.causalHistory.at(-1)?.metricChanges.find((candidate) => candidate.metric === definition.key);
    const series = history.slice(-18).map((point) => point[definition.key]);
    if (series.length === 1 && change) series.unshift(change.from);
    const value = country.metrics[definition.key];
    const previous = change?.from ?? series.at(-2) ?? value;
    const delta = round(value - previous, 2);
    const trend = Math.abs(delta) < 0.01 ? 'flat' : delta > 0 ? 'up' : 'down';
    return {
      ...definition,
      value,
      delta,
      trend,
      trendIsGood: trend === 'flat' || (trend === 'up') === definition.higherIsBetter,
      level: metricLevel(definition.key, value),
      series,
    };
  });
}

function eventIntensity(country: CountryState, event: ActiveEvent) {
  if (country.activeEvents.some((active) => active.id === event.id)) return clamp01(0.35 + event.severity * 0.35);
  return clamp01(Math.max(0, ...Object.values(country.eventResiduals[event.id] ?? {}).map((value) => value ?? 0)) / 18);
}

export function selectWorldVisualState(country: CountryState): WorldVisualState {
  const regions = Object.fromEntries(regionIds.map((id) => {
    const region = country.regions[id];
    const events = country.eventHistory
      .filter((event) => event.region === id)
      .map((event) => ({
        id: event.id,
        type: event.type,
        label: EVENT_PRESENTATION[event.type].label,
        intensity: eventIntensity(country, event),
        active: country.activeEvents.some((active) => active.id === event.id),
        monthsRemaining: country.activeEvents.find((active) => active.id === event.id)?.monthsRemaining ?? 0,
      }))
      .filter((event) => event.intensity >= 0.03)
      .sort((a, b) => Number(b.active) - Number(a.active) || b.intensity - a.intensity);
    const hasNegative = events.some((event) => EVENT_PRESENTATION[event.type].tone === 'negative' && event.active);
    const hasBoom = events.some((event) => event.type === 'productivity_boom' && event.active);
    const damage = clamp01((100 - region.health) / 55);
    const recovery = !hasNegative && (damage > 0.02 || events.some((event) => !event.active)) ? 1 - damage : 0;
    return [id, {
      id,
      health: region.health,
      productivity: region.productivity,
      damage,
      activity: clamp01((region.productivity - 25) / 105),
      recovery,
      status: hasNegative ? 'disrupted' : hasBoom || region.productivity >= 108 ? 'expanding' : recovery > 0 ? 'recovering' : 'stable',
      events,
    } satisfies RegionVisualState];
  })) as Record<RegionId, RegionVisualState>;

  return {
    month: country.month,
    regions,
    activity: {
      roadFreight: clamp01((country.metrics.gdp - 35) / 95),
      shipping: clamp01((Math.min(country.metrics.importsIndex, country.metrics.exportsIndex) - 25) / 105),
      factory: regions.industrial.activity,
      power: regions.energy.activity,
    },
  };
}

function nodeLabel(country: CountryState, node: string) {
  if (node.startsWith('event:')) {
    const event = country.eventHistory.find((candidate) => candidate.id === node.slice(6));
    return event ? `${EVENT_PRESENTATION[event.type].label} · ${country.regions[event.region].name}` : 'External event';
  }
  if (node.startsWith('policy:')) return node.slice(7).replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
  if (node.startsWith('sector:')) return country.sectors[node.slice(7) as SectorId]?.name ?? node.slice(7);
  if (node.startsWith('metric:')) return METRIC_PRESENTATION.find((metric) => metric.key === node.slice(7))?.label ?? node.slice(7);
  return node.replaceAll('-', ' ');
}

export function selectMetricExplanation(country: CountryState, metric: MetricKey): MetricExplanation {
  const definition = METRIC_PRESENTATION.find((item) => item.key === metric);
  const record = [...country.causalHistory].reverse().find((month) => month.metricChanges.some((change) => change.metric === metric));
  const change = record?.metricChanges.find((candidate) => candidate.metric === metric);
  if (!record || !change) {
    const value = country.metrics[metric];
    return { metric, label: definition?.label ?? metric, month: country.month, from: value, to: value, delta: 0, summary: 'No recorded monthly change yet.', contributors: [] };
  }
  const contributors = change.contributors
    .filter((contributor) => Math.abs(contributor.effect) >= 0.005)
    .sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect))
    .slice(0, 6)
    .map((contributor) => ({ ...contributor, path: [...new Set([...contributor.roots, ...contributor.chain])].map((node) => nodeLabel(country, node)) }));
  const direction = change.delta > 0 ? 'rose' : change.delta < 0 ? 'fell' : 'held steady';
  return {
    metric,
    label: definition?.label ?? metric,
    month: record.month,
    from: change.from,
    to: change.to,
    delta: change.delta,
    summary: `${definition?.label ?? metric} ${direction} from ${change.from.toFixed(1)} to ${change.to.toFixed(1)} in month ${record.month}.`,
    contributors,
  };
}

export function selectTimeline(country: CountryState): TimelineItem[] {
  const logs: TimelineItem[] = country.log.map((entry) => ({
    id: entry.id,
    month: entry.month,
    kind: entry.title.startsWith('Policy changed:') ? 'policy' : entry.causes?.some((cause) => cause.startsWith('event:')) ? 'event' : 'system',
    title: entry.title,
    detail: entry.detail,
    causes: entry.causes ?? [],
  }));
  const consequences: TimelineItem[] = country.causalHistory.flatMap((record) => record.metricChanges
    .filter((change) => Math.abs(change.delta) >= (['inflation', 'unemployment', 'debtPct'].includes(change.metric) ? 0.1 : 0.5))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 2)
    .map((change) => ({
      id: change.id,
      month: record.month,
      kind: 'consequence' as const,
      title: `${METRIC_PRESENTATION.find((metric) => metric.key === change.metric)?.label ?? change.metric} ${change.delta > 0 ? 'rose' : 'fell'}`,
      detail: `${change.from.toFixed(1)} → ${change.to.toFixed(1)} (${change.delta > 0 ? '+' : ''}${change.delta.toFixed(1)})`,
      causes: [...change.contributors].sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect)).slice(0, 3).map((contributor) => contributor.description),
      metric: change.metric,
      delta: change.delta,
    })));
  return [...logs, ...consequences]
    .sort((a, b) => b.month - a.month || (a.kind === 'consequence' ? 1 : -1))
    .slice(0, 24);
}

export function selectRegionInspector(country: CountryState, id: RegionId): RegionInspectorState {
  const world = selectWorldVisualState(country).regions[id];
  const sectors = regionSectors[id];
  return {
    id,
    health: country.regions[id].health,
    productivity: country.regions[id].productivity,
    damage: world.damage * 100,
    capacity: sectors.reduce((sum, sector) => sum + country.sectors[sector].capacity, 0) / sectors.length,
    status: world.status,
    activeEffects: world.events,
    recentEvents: country.eventHistory.filter((event) => event.region === id).slice(-4).reverse(),
    metrics: regionMetrics[id].map((key) => ({ key, label: METRIC_PRESENTATION.find((metric) => metric.key === key)?.label ?? key, value: country.metrics[key] })),
    sectors,
  };
}
