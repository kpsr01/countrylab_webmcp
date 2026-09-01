import type {
  ActiveEvent,
  CausalContributor,
  CausalMonthRecord,
  CountryState,
  CounterfactualResult,
  EventType,
  MetricKey,
  Metrics,
  Policies,
  PolicyKey,
  RegionId,
  SectorId,
  SectorState,
  SectorChange,
  MetricChange,
} from './types';
type NumericMap = Partial<Record<SectorId, number>>;
type SectorTarget = { target: number; contributors: CausalContributor[]; description: string };

const SECTORS: SectorId[] = ['households', 'agriculture', 'manufacturing', 'energy', 'trade', 'banking', 'government', 'central_bank'];
const OUTPUT_ORDER: SectorId[] = ['central_bank', 'energy', 'agriculture', 'households', 'banking', 'manufacturing', 'trade', 'government'];
const METRICS: MetricKey[] = ['importsIndex', 'foodIndex', 'energyIndex', 'industrialOutput', 'exportsIndex', 'gdp', 'inflation', 'unemployment', 'debtPct', 'confidence'];
const REGION_SECTOR: Record<RegionId, SectorId> = {
  capital: 'government',
  farmbelt: 'agriculture',
  industrial: 'manufacturing',
  port: 'trade',
  energy: 'energy',
};
const POLICY_BOUNDS: Record<PolicyKey, [number, number]> = {
  interestRate: [0, 20],
  incomeTax: [0, 60],
  corporateTax: [0, 60],
  governmentSpending: [0, 100],
  tariffRate: [0, 50],
  emergencySpending: [0, 100],
};
const METRIC_BOUNDS: Record<MetricKey, [number, number]> = {
  gdp: [35, 220],
  inflation: [-1, 25],
  unemployment: [1.5, 30],
  debtPct: [5, 180],
  foodIndex: [30, 125],
  energyIndex: [30, 125],
  industrialOutput: [25, 130],
  importsIndex: [25, 130],
  exportsIndex: [25, 130],
  confidence: [5, 95],
};
const EVENT_DURATION: Record<EventType, number> = {
  flood: 5,
  drought: 8,
  war: 10,
  oil_shock: 7,
  banking_crisis: 6,
  productivity_boom: 8,
};
const EVENT_LABEL: Record<EventType, string> = {
  flood: 'Flood',
  drought: 'Drought',
  war: 'Conflict',
  oil_shock: 'Energy shock',
  banking_crisis: 'Banking crisis',
  productivity_boom: 'Productivity boom',
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
const round = (value: number, digits = 2) => Number(value.toFixed(digits));
const safeNumber = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback;

function id(state: CountryState, prefix: string) {
  const value = `${prefix}-${state.nextId}`;
  state.nextId += 1;
  return value;
}

function source(type: CausalContributor['sourceType'], sourceId: string, effect: number, description: string, chain: string[] = [], roots: string[] = []): CausalContributor {
  return { sourceType: type, sourceId, effect, description, roots: unique(roots.length ? roots : chain.filter((node) => node.startsWith('event:') || node.startsWith('policy:'))), chain };
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function rootedSources(type: CausalContributor['sourceType'], sourceId: string, effect: number, description: string, roots: string[], suffix: string[]) {
  if (!roots.length) return [source(type, sourceId, effect, description, suffix)];
  return [source(type, sourceId, effect, description, [roots[0], ...suffix], roots)];
}

function reconcile(contributors: CausalContributor[], delta: number): CausalContributor[] {
  const normalized = contributors.map((contributor) => ({ ...contributor, effect: round(contributor.effect, 3) }));
  const residual = round(delta - normalized.reduce((sum, contributor) => sum + contributor.effect, 0), 3);
  if (residual !== 0) normalized.push(source('system', 'rounding-and-bounds', residual, 'Rounding or a sensible bound reconciled the displayed change.'));
  return normalized;
}

function eventRegionMultiplier(type: EventType, region: RegionId, sector: SectorId) {
  const target = REGION_SECTOR[region];
  if (target === sector) return 1.5;
  if (type === 'flood' && sector === 'trade') return region === 'port' ? 1.5 : 0.55;
  if (type === 'drought' && sector === 'agriculture') return region === 'farmbelt' ? 1.5 : 0.55;
  if (type === 'war' && (sector === 'manufacturing' || sector === 'trade')) return region === 'industrial' || region === 'port' ? 1.25 : 0.7;
  if (type === 'oil_shock' && sector === 'manufacturing') return region === 'energy' ? 1.2 : 0.7;
  if (type === 'banking_crisis' && sector === 'banking') return region === 'capital' ? 1.5 : 0.7;
  if (type === 'productivity_boom' && sector === 'manufacturing') return region === 'industrial' ? 1.5 : 0.7;
  return 0.7;
}

function eventSectorImpact(event: ActiveEvent): NumericMap {
  const base: NumericMap = {
    flood: { trade: -8, agriculture: -1.5, households: -1 },
    drought: { agriculture: -8, households: -1.5, trade: -1 },
    war: { trade: -5, manufacturing: -4, households: -2, banking: -1 },
    oil_shock: { energy: -8, manufacturing: -3, households: -1 },
    banking_crisis: { banking: -10, households: -3, manufacturing: -2, trade: -1 },
    productivity_boom: { manufacturing: 7, agriculture: 1, trade: 2 },
  }[event.type];
  const targeted = REGION_SECTOR[event.region];
  const targetEffect = event.type === 'productivity_boom' ? 2 : -2;
  const withTarget = { ...base, [targeted]: (base[targeted] ?? 0) + targetEffect };
  return Object.fromEntries(Object.entries(withTarget).map(([sector, effect]) => [sector, (effect ?? 0) * eventRegionMultiplier(event.type, event.region, sector as SectorId) * event.severity])) as NumericMap;
}

function eventRoots(events: ActiveEvent[], sector: SectorId) {
  return events.filter((event) => (eventSectorImpact(event)[sector] ?? 0) !== 0).map((event) => `event:${event.id}`);
}
function historicalEventRoots(next: CountryState, sector: SectorId) {
  return Object.entries(next.eventResiduals)
    .filter(([, effects]) => Math.abs(effects[sector] ?? 0) >= 0.5)
    .map(([eventId]) => `event:${eventId}`);
}

function sectorRoots(next: CountryState, sector: SectorId, events: ActiveEvent[]) {
  const currentPolicyRoots = new Set(policyRootsForSector(next, sector));
  const persistent = next.sectors[sector].causalRoots.filter((root) => currentPolicyRoots.has(root));
  return unique([...persistent, ...eventRoots(events, sector), ...historicalEventRoots(next, sector)]);
}

function policyRootsForSector(state: CountryState, sector: SectorId) {
  const { policies } = state;
  const roots: string[] = [];
  if (sector === 'households' && policies.incomeTax !== 22) roots.push('policy:incomeTax');
  if (sector === 'manufacturing' && policies.corporateTax !== 20) roots.push('policy:corporateTax');
  if (sector === 'trade' && policies.tariffRate !== 5) roots.push('policy:tariffRate');
  if (sector === 'banking' && policies.interestRate !== 3.5) roots.push('policy:interestRate');
  if (sector === 'government' && policies.governmentSpending !== 50) roots.push('policy:governmentSpending');
  if (policies.emergencySpending > 0 && sector !== 'central_bank') roots.push('policy:emergencySpending');
  return roots;
}

function sectorCapacityDelta(state: CountryState, sector: SectorId, events: ActiveEvent[]) {
  const current = state.sectors[sector];
  const contributors: CausalContributor[] = [];
  const recovery = (100 - current.capacity) * 0.12;
  if (recovery) contributors.push(source('recovery', 'capacity-recovery', recovery, 'Sector capacity gradually returns toward its normal level.', [`sector:${sector}`]));
  for (const event of events) {
    const impact = eventSectorImpact(event)[sector] ?? 0;
    if (impact) contributors.push(source('event', `event:${event.id}`, impact, `${EVENT_LABEL[event.type]} changes ${current.name.toLowerCase()} capacity.`, [`event:${event.id}`, `sector:${sector}`]));
  }
  const { policies } = state;
  const policyEffects: Partial<Record<SectorId, [number, string, string]>> = {
    households: [-(policies.incomeTax - 22) * 0.05, 'Income tax changes household capacity.', 'incomeTax'],
    manufacturing: [-(policies.corporateTax - 20) * 0.06, 'Corporate tax changes reinvestment capacity.', 'corporateTax'],
    trade: [-(policies.tariffRate - 5) * 0.025, 'Tariffs change trade handling capacity.', 'tariffRate'],
    banking: [-(policies.interestRate - 3.5) * 0.25, 'Interest rates change banking conditions.', 'interestRate'],
    government: [(policies.governmentSpending - 50) * 0.04, 'Public spending supports government capacity.', 'governmentSpending'],
  };
  const policyEffect = policyEffects[sector];
  if (policyEffect?.[0]) contributors.push(source('policy', policyEffect[2], policyEffect[0], policyEffect[1], [`policy:${policyEffect[2]}`, `sector:${sector}`]));
  if (sector === 'government' && policies.emergencySpending > 0) contributors.push(source('policy', 'emergencySpending', policies.emergencySpending * 0.05, 'Emergency spending supports government capacity.', ['policy:emergencySpending', 'sector:government']));
  return contributors;
}

function updateSectorCapacity(state: CountryState, next: CountryState, sector: SectorId, events: ActiveEvent[], changes: SectorChange[]) {
  const current = state.sectors[sector];
  const contributors = sectorCapacityDelta(state, sector, events);
  const roots = unique([...sectorRoots(next, sector, events), ...policyRootsForSector(state, sector)]);
  const to = round(clamp(current.capacity + contributors.reduce((sum, contributor) => sum + contributor.effect, 0), 20, 125));
  const delta = round(to - current.capacity);
  changes.push({ id: id(next, 'sector-change'), sector, field: 'capacity', from: current.capacity, to, delta, contributors: reconcile(contributors, delta) });
  next.sectors[sector] = { ...next.sectors[sector], capacity: to, causalRoots: roots };
}

function updateSectorHealth(state: CountryState, next: CountryState, sector: SectorId, events: ActiveEvent[], changes: SectorChange[]) {
  const current = state.sectors[sector];
  const contributors: CausalContributor[] = [source('recovery', 'health-recovery', (100 - current.health) * 0.08, 'Sector health slowly recovers toward normal.')];
  for (const event of events) {
    const impact = (eventSectorImpact(event)[sector] ?? 0) * 0.45;
    if (impact) contributors.push(source('event', `event:${event.id}`, impact, `${EVENT_LABEL[event.type]} changes ${current.name.toLowerCase()} health.`, [`event:${event.id}`, `sector:${sector}`]));
  }
  if (state.policies.emergencySpending > 0 && sector !== 'central_bank') contributors.push(source('policy', 'emergencySpending', state.policies.emergencySpending * 0.025, 'Emergency spending repairs damaged capacity and confidence.', ['policy:emergencySpending', `sector:${sector}`]));
  const to = round(clamp(current.health + contributors.reduce((sum, contributor) => sum + contributor.effect, 0), 20, 125));
  const delta = round(to - current.health);
  changes.push({ id: id(next, 'sector-change'), sector, field: 'health', from: current.health, to, delta, contributors: reconcile(contributors, delta) });
  next.sectors[sector] = { ...next.sectors[sector], health: to, causalRoots: unique([...sectorRoots(next, sector, events), ...policyRootsForSector(state, sector)]) };
}

function targetContributors(next: CountryState, state: CountryState, sector: SectorId, events: ActiveEvent[]): SectorTarget {
  const current = state.sectors[sector];
  const s = next.sectors;
  const roots = sectorRoots(next, sector, events);
  const upstream = (id: SectorId) => sectorRoots(next, id, events);
  const contributors: CausalContributor[] = [
    ...rootedSources('sector', `sector:${sector}:capacity`, (s[sector].capacity - 100) * 0.65, 'Sector capacity changes the output ceiling.', roots, [`sector:${sector}:capacity`, `sector:${sector}`]),
    ...rootedSources('sector', `sector:${sector}:health`, (s[sector].health - 100) * 0.35, 'Sector health changes usable output.', roots, [`sector:${sector}:health`, `sector:${sector}`]),
    source('recovery', 'output-normalization', 100 - current.output, 'Output adjusts gradually toward its normal level.', [`sector:${sector}`]),
  ];
  const add = (type: CausalContributor['sourceType'], sourceId: string, effect: number, description: string, sourceRoots: string[], suffix: string[]) => contributors.push(...rootedSources(type, sourceId, effect, description, sourceRoots, suffix));
  switch (sector) {
    case 'central_bank':
      add('policy', 'interestRate', (3.5 - next.policies.interestRate) * 0.05, 'The policy rate changes central-bank operating conditions.', [], ['policy:interestRate', 'sector:central_bank']);
      break;
    case 'energy':
      add('sector', 'sector:central_bank', (s.central_bank.output - 100) * 0.1, 'Monetary stability supports energy financing.', upstream('central_bank'), ['sector:central_bank', 'sector:energy']);
      break;
    case 'agriculture':
      add('sector', 'sector:energy', (s.energy.output - 100) * 0.04, 'Agriculture needs reliable energy.', upstream('energy'), ['sector:energy', 'sector:agriculture']);
      break;
    case 'households':
      add('sector', 'sector:central_bank', (s.central_bank.output - 100) * 0.12, 'Monetary stability supports household activity.', upstream('central_bank'), ['sector:central_bank', 'sector:households']);
      add('policy', 'interestRate', -Math.max(0, next.policies.interestRate - 3.5) * 1.5, 'Higher borrowing costs reduce household activity.', [], ['policy:interestRate', 'sector:households']);
      break;
    case 'banking':
      add('sector', 'sector:households', (s.households.output - 100) * 0.12, 'Household activity supports loan demand.', upstream('households'), ['sector:households', 'sector:banking']);
      add('sector', 'sector:central_bank', (s.central_bank.output - 100) * 0.12, 'Monetary stability supports bank liquidity.', upstream('central_bank'), ['sector:central_bank', 'sector:banking']);
      break;
    case 'manufacturing':
      add('sector', 'sector:energy', (s.energy.output - 100) * 0.18, 'Manufacturing needs energy.', upstream('energy'), ['sector:energy', 'sector:manufacturing']);
      add('sector', 'sector:banking', (s.banking.output - 100) * 0.12, 'Manufacturing needs credit.', upstream('banking'), ['sector:banking', 'sector:manufacturing']);
      add('policy', 'corporateTax', -(next.policies.corporateTax - 20) * 0.04, 'Corporate tax changes reinvestment incentives.', [], ['policy:corporateTax', 'sector:manufacturing']);
      break;
    case 'trade':
      add('sector', 'sector:manufacturing', (s.manufacturing.output - 100) * 0.12, 'Factories supply goods for trade.', upstream('manufacturing'), ['sector:manufacturing', 'sector:trade']);
      add('sector', 'sector:banking', (s.banking.output - 100) * 0.08, 'Credit supports trade finance.', upstream('banking'), ['sector:banking', 'sector:trade']);
      add('policy', 'tariffRate', -(next.policies.tariffRate - 5) * 0.06, 'Tariffs change border costs.', [], ['policy:tariffRate', 'sector:trade']);
      break;
    case 'government':
      add('sector', 'sector:households', (s.households.output - 100) * 0.08, 'Household activity supports public administration.', upstream('households'), ['sector:households', 'sector:government']);
      add('sector', 'sector:central_bank', (s.central_bank.output - 100) * 0.08, 'Monetary stability supports public finance.', upstream('central_bank'), ['sector:central_bank', 'sector:government']);
      add('policy', 'governmentSpending', (next.policies.governmentSpending - 50) * 0.08, 'Public spending expands government activity.', [], ['policy:governmentSpending', 'sector:government']);
      add('policy', 'emergencySpending', next.policies.emergencySpending * 0.05, 'Emergency spending expands response capacity.', [], ['policy:emergencySpending', 'sector:government']);
      break;
  }
  const targetDelta = contributors.reduce((sum, contributor) => sum + contributor.effect, 0);
  return { target: current.output + targetDelta, contributors, description: `${next.sectors[sector].name} output combines its capacity, health, inputs and direct policy conditions.` };
}

function updateSectorOutput(state: CountryState, next: CountryState, sector: SectorId, events: ActiveEvent[], changes: SectorChange[]) {
  const current = state.sectors[sector];
  const target = targetContributors(next, state, sector, events);
  const activeRoots = eventRoots(events, sector);
  const roots = unique([...next.sectors[sector].causalRoots, ...activeRoots]);
  const scaled = target.contributors.map((contributor) => ({ ...contributor, effect: contributor.effect * 0.42, chain: contributor.chain.length ? contributor.chain : [...roots, `sector:${sector}`] }));
  const to = round(clamp(current.output + scaled.reduce((sum, contributor) => sum + contributor.effect, 0), 25, 130));
  const delta = round(to - current.output);
  changes.push({ id: id(next, 'sector-change'), sector, field: 'output', from: current.output, to, delta, contributors: reconcile(scaled, delta) });
  const stillAffected = activeRoots.length > 0 || Math.abs(next.sectors[sector].capacity - 100) >= 0.5 || Math.abs(next.sectors[sector].health - 100) >= 0.5 || Math.abs(to - 100) >= 0.5;
  next.sectors[sector] = { ...next.sectors[sector], output: to, causalRoots: stillAffected ? roots : [] };
}

const BASELINE_METRICS: Metrics = {
  gdp: 100, inflation: 2.4, unemployment: 5.2, debtPct: 44, foodIndex: 100,
  energyIndex: 100, industrialOutput: 100, importsIndex: 100, exportsIndex: 100, confidence: 64,
};

function metricSourceRoots(next: CountryState, key: MetricKey) {
  const sectorRootsFor = (...sectors: SectorId[]) => sectors.flatMap((sector) => next.sectors[sector].causalRoots);
  const related: Record<MetricKey, string[]> = {
    importsIndex: sectorRootsFor('trade'),
    foodIndex: [...sectorRootsFor('agriculture', 'trade'), ...(next.metricRoots.importsIndex ?? [])],
    energyIndex: sectorRootsFor('energy'),
    industrialOutput: sectorRootsFor('manufacturing', 'energy', 'banking'),
    exportsIndex: sectorRootsFor('trade', 'manufacturing'),
    gdp: sectorRootsFor(...SECTORS),
    inflation: [...(next.metricRoots.foodIndex ?? []), ...(next.metricRoots.energyIndex ?? []), ...(next.metricRoots.importsIndex ?? []), ...sectorRootsFor('households')],
    unemployment: [...(next.metricRoots.gdp ?? []), ...sectorRootsFor('manufacturing', 'households')],
    debtPct: [...(next.metricRoots.gdp ?? []), ...sectorRootsFor('government')],
    confidence: [...(next.metricRoots.gdp ?? []), ...sectorRootsFor('households', 'banking', 'government')],
  };
  return unique(related[key]);
}

function metricChange(next: CountryState, key: MetricKey, contributors: CausalContributor[], changes: MetricChange[], digits = 2) {
  const current = next.metrics[key];
  const delta = contributors.reduce((sum, contributor) => sum + contributor.effect, 0);
  const [min, max] = METRIC_BOUNDS[key];
  const to = round(clamp(current + delta, min, max), digits);
  const actualDelta = round(to - current, digits);
  const roots = unique([...(next.metricRoots[key] ?? []), ...metricSourceRoots(next, key), ...contributors.flatMap((contributor) => contributor.roots)]);
  next.metricRoots = { ...next.metricRoots, [key]: Math.abs(to - BASELINE_METRICS[key]) >= 0.5 ? roots : [] };
  changes.push({ id: id(next, 'metric-change'), metric: key, from: current, to, delta: actualDelta, contributors: reconcile(contributors, actualDelta) });
  next.metrics = { ...next.metrics, [key]: to };
}



function updateMetrics(state: CountryState, next: CountryState, events: ActiveEvent[], changes: MetricChange[]) {
  const old = state.metrics;
  const s = next.sectors;
  const sectorSource = (sector: SectorId, type: CausalContributor['sourceType'], sourceId: string, effect: number, description: string, suffix: string[]) =>
    rootedSources(type, sourceId, effect, description, sectorRoots(next, sector, events), [`sector:${sector}`, ...suffix]);
  const metricSource = (key: MetricKey, type: CausalContributor['sourceType'], sourceId: string, effect: number, description: string, suffix: string[]) =>
    rootedSources(type, sourceId, effect, description, metricSourceRoots(next, key), suffix);
  metricChange(next, 'importsIndex', [
    ...sectorSource('trade', 'sector', 'sector:trade', (s.trade.output - 100) * 0.55, 'Trade output determines import handling capacity.', ['metric:importsIndex']),
    source('policy', 'tariffRate', -(next.policies.tariffRate - 5) * 0.08, 'Tariffs reduce import demand and throughput.', ['policy:tariffRate', 'metric:importsIndex']),
    source('recovery', 'imports-normalization', (100 - old.importsIndex) * 0.14, 'Import flows normalize gradually.', ['metric:importsIndex']),
  ], changes, 1);
  const domesticFood = (s.agriculture.output - 100) * 0.22;
  const importedFood = (next.metrics.importsIndex - 100) * 0.1;
  const domesticFoodRoots = unique([...sectorRoots(next, 'agriculture', events), ...(next.causalBranches.foodDomestic ?? [])]);
  const importedFoodRoots = unique([...sectorRoots(next, 'trade', events), ...(next.metricRoots.importsIndex ?? []), ...(next.causalBranches.foodImported ?? [])]);
  metricChange(next, 'foodIndex', [
    ...rootedSources('sector', 'sector:agriculture', domesticFood, 'Agricultural output changes domestic food availability.', domesticFoodRoots, ['sector:agriculture', 'metric:foodIndex']),
    ...rootedSources('metric', 'importsIndex', importedFood, 'Imported food availability follows the trade and imports chain.', importedFoodRoots, ['sector:trade', 'metric:importsIndex', 'metric:foodIndex']),
    source('recovery', 'food-normalization', (100 - old.foodIndex) * 0.18, 'Food supply normalizes gradually.', ['metric:foodIndex']),
  ], changes, 1);
  const foodRootsPersist = Math.abs(next.metrics.foodIndex - BASELINE_METRICS.foodIndex) >= 0.5;
  next.causalBranches = {
    ...next.causalBranches,
    foodDomestic: foodRootsPersist ? domesticFoodRoots : [],
    foodImported: foodRootsPersist ? importedFoodRoots : [],
  };
  metricChange(next, 'energyIndex', [
    ...sectorSource('energy', 'sector', 'sector:energy', (s.energy.output - 100) * 0.3, 'Energy-sector output changes available energy.', ['metric:energyIndex']),
    source('recovery', 'energy-normalization', (100 - old.energyIndex) * 0.18, 'Energy supply normalizes gradually.', ['metric:energyIndex']),
  ], changes, 1);
  metricChange(next, 'industrialOutput', [
    ...sectorSource('manufacturing', 'sector', 'sector:manufacturing', (s.manufacturing.output - 100) * 0.5, 'Manufacturing output is the main industrial-output driver.', ['metric:industrialOutput']),
    ...sectorSource('energy', 'sector', 'sector:energy', (s.energy.output - 100) * 0.12, 'Energy availability constrains industrial activity.', ['metric:industrialOutput']),
    ...sectorSource('banking', 'sector', 'sector:banking', (s.banking.output - 100) * 0.08, 'Credit conditions support industrial investment.', ['metric:industrialOutput']),
    source('recovery', 'industrial-normalization', (100 - old.industrialOutput) * 0.12, 'Industrial output moves gradually rather than jumping instantly.', ['metric:industrialOutput']),
  ], changes, 1);
  metricChange(next, 'exportsIndex', [
    ...sectorSource('manufacturing', 'sector', 'sector:manufacturing', (s.manufacturing.output - 100) * 0.35, 'Manufacturing output supplies exportable goods.', ['metric:exportsIndex']),
    ...sectorSource('trade', 'sector', 'sector:trade', (s.trade.output - 100) * 0.25, 'Trade capacity moves goods to foreign buyers.', ['metric:exportsIndex']),
    source('recovery', 'exports-normalization', (100 - old.exportsIndex) * 0.14, 'Exports adjust gradually to new capacity.', ['metric:exportsIndex']),
  ], changes, 1);
  const outputWeighted = [['households', 0.22], ['agriculture', 0.12], ['manufacturing', 0.28], ['energy', 0.1], ['trade', 0.1], ['banking', 0.08], ['government', 0.1]] as const;
  metricChange(next, 'gdp', [
    ...outputWeighted.flatMap(([sector, weight]) => sectorSource(sector, 'sector', `sector:${sector}`, (s[sector].output - 100) * weight, `${s[sector].name} output contributes to GDP.`, ['metric:gdp'])),
    source('policy', 'governmentSpending', (next.policies.governmentSpending - 50) * 0.04, 'Government spending supports aggregate demand.', ['policy:governmentSpending', 'metric:gdp']),
    source('policy', 'interestRate', -(next.policies.interestRate - 3.5) * 0.08, 'Higher rates reduce interest-sensitive demand.', ['policy:interestRate', 'metric:gdp']),
    source('recovery', 'gdp-normalization', (100 - old.gdp) * 0.08, 'GDP moves gradually toward normal capacity.', ['metric:gdp']),
  ], changes, 2);
  const foodPressure = Math.max(0, 100 - next.metrics.foodIndex) * 0.035;
  const energyPressure = Math.max(0, 100 - next.metrics.energyIndex) * 0.04;
  const importPressure = Math.max(0, 100 - next.metrics.importsIndex) * 0.015;
  const domesticShortage = Math.max(0, -domesticFood);
  const importShortage = Math.max(0, -importedFood);
  const shortageTotal = domesticShortage + importShortage || 1;
  metricChange(next, 'inflation', [
    ...rootedSources('metric', 'foodIndex', foodPressure * domesticShortage / shortageTotal, 'Lower domestic food supply creates food-price pressure.', next.causalBranches.foodDomestic ?? [], ['sector:agriculture', 'metric:foodIndex', 'metric:inflation']),
    ...rootedSources('metric', 'foodIndex', foodPressure * importShortage / shortageTotal, 'Lower imported food supply creates food-price pressure.', next.causalBranches.foodImported ?? [], ['sector:trade', 'metric:importsIndex', 'metric:foodIndex', 'metric:inflation']),
    ...metricSource('energyIndex', 'metric', 'energyIndex', energyPressure, 'Lower energy supply raises operating and transport costs.', ['sector:energy', 'metric:energyIndex', 'metric:inflation']),
    ...metricSource('importsIndex', 'metric', 'importsIndex', importPressure, 'Reduced imports tighten available goods.', ['sector:trade', 'metric:importsIndex', 'metric:inflation']),
    ...sectorSource('households', 'sector', 'sector:households', Math.max(0, s.households.output - 100) * 0.018, 'Strong household demand adds modest demand pressure.', ['metric:inflation']),
    source('policy', 'interestRate', -Math.max(0, next.policies.interestRate - 3.5) * 0.1, 'Higher rates cool demand with a short lag.', ['policy:interestRate', 'metric:inflation']),
    source('recovery', 'inflation-anchor', (2.4 - old.inflation) * 0.15, 'Inflation gradually returns toward the stable anchor.', ['metric:inflation']),
  ], changes, 2);
  const gdpDelta = next.metrics.gdp - old.gdp;
  metricChange(next, 'unemployment', [
    source('metric', 'gdp', -gdpDelta * 0.1, 'Output growth changes labor demand.', ['metric:gdp', 'metric:unemployment']),
    ...sectorSource('manufacturing', 'sector', 'sector:manufacturing', Math.max(0, 100 - s.manufacturing.output) * 0.025, 'Industrial weakness raises unemployment.', ['metric:unemployment']),
    source('policy', 'interestRate', Math.max(0, next.policies.interestRate - 3.5) * 0.03, 'Tighter credit weakens hiring.', ['policy:interestRate', 'metric:unemployment']),
    source('recovery', 'unemployment-anchor', (5.2 - old.unemployment) * 0.08, 'Employment gradually returns toward its stable baseline.', ['metric:unemployment']),
  ], changes, 2);
  const taxRevenue = (next.policies.incomeTax * 0.04 + next.policies.corporateTax * 0.025) * (next.metrics.gdp / 100);
  metricChange(next, 'debtPct', [
    source('policy', 'governmentSpending', (next.policies.governmentSpending - 50) * 0.045, 'Spending above the normal level adds borrowing.', ['policy:governmentSpending', 'metric:debtPct']),
    source('policy', 'emergencySpending', next.policies.emergencySpending * 0.06, 'Emergency spending is financed immediately through borrowing.', ['policy:emergencySpending', 'metric:debtPct']),
    source('policy', 'taxRevenue', -(taxRevenue - 1.38), 'Income and corporate taxes finance government activity.', ['policy:incomeTax', 'policy:corporateTax', 'metric:debtPct']),
    source('metric', 'gdp', -(next.metrics.gdp - old.gdp) * 0.06, 'Growth improves the debt-to-GDP denominator.', ['metric:gdp', 'metric:debtPct']),
  ], changes, 2);
  metricChange(next, 'confidence', [
    ...sectorSource('households', 'sector', 'sector:households', (s.households.output - 100) * 0.12, 'Household conditions shape confidence.', ['metric:confidence']),
    source('metric', 'inflation', -(next.metrics.inflation - 2.4) * 0.5, 'Inflation erodes purchasing-power confidence.', ['metric:inflation', 'metric:confidence']),
    source('metric', 'unemployment', -(next.metrics.unemployment - 5.2) * 0.3, 'Unemployment reduces household optimism.', ['metric:unemployment', 'metric:confidence']),
    source('policy', 'emergencySpending', next.policies.emergencySpending * 0.04, 'Emergency support protects confidence during shocks.', ['policy:emergencySpending', 'metric:confidence']),
    source('recovery', 'confidence-anchor', (64 - old.confidence) * 0.12, 'Confidence gradually returns toward its stable anchor.', ['metric:confidence']),
  ], changes, 1);
}
function pruneEventHistory(next: CountryState) {
  const referenced = new Set<string>(next.activeEvents.map((event) => `event:${event.id}`));
  const metricRootNodes = [...Object.values(next.metricRoots).flatMap((roots) => roots ?? []), ...Object.values(next.causalBranches).flatMap((roots) => roots ?? [])];
  for (const node of metricRootNodes) if (node.startsWith('event:')) referenced.add(node);
  for (const month of next.causalHistory) for (const change of [...month.sectorChanges, ...month.metricChanges]) for (const contributor of change.contributors) for (const node of [...contributor.chain, ...contributor.roots]) if (node.startsWith('event:')) referenced.add(node);
  const recent = next.eventHistory.slice(-120);
  const keep = new Set([...recent.map((event) => event.id), ...[...referenced].map((node) => node.slice('event:'.length))]);
  next.eventHistory = next.eventHistory.filter((event) => keep.has(event.id));
}

function updateRegions(next: CountryState) {
  for (const [region, sector] of Object.entries(REGION_SECTOR) as [RegionId, SectorId][]) next.regions[region] = { ...next.regions[region], health: round(next.sectors[sector].health), productivity: round(next.sectors[sector].output) };
}

export function advanceOneMonth(state: CountryState): CountryState {
  const next = structuredClone(state);
  const events = state.activeEvents;
  const sectorChanges: SectorChange[] = [];
  const metricChanges: MetricChange[] = [];
  for (const sector of SECTORS) updateSectorCapacity(state, next, sector, events, sectorChanges);
  for (const sector of SECTORS) updateSectorHealth(state, next, sector, events, sectorChanges);
  for (const sector of OUTPUT_ORDER) updateSectorOutput(state, next, sector, events, sectorChanges);
  updateMetrics(state, next, events, metricChanges);
  next.month = state.month + 1;
  next.activeEvents = state.activeEvents.map((event) => ({ ...event, monthsRemaining: event.monthsRemaining - 1 })).filter((event) => event.monthsRemaining > 0);
  const activeIds = new Set(events.map((event) => event.id));
  const eventById = new Map(state.eventHistory.map((event) => [event.id, event]));
  const residuals: Record<string, Partial<Record<SectorId, number>>> = {};
  for (const eventId of unique([...Object.keys(state.eventResiduals), ...events.map((event) => event.id)])) {
    const event = eventById.get(eventId);
    const prior = state.eventResiduals[eventId] ?? {};
    const impact = event ? eventSectorImpact(event) : {};
    const sectors = unique([...Object.keys(prior), ...Object.keys(impact)]) as SectorId[];
    const factor = activeIds.has(eventId) ? 1 : 0.96;
    const decayed = Object.fromEntries(sectors.map((sector) => [
      sector,
      round(Math.abs(prior[sector] ?? 0) * factor + (activeIds.has(eventId) ? Math.abs(impact[sector] ?? 0) * 0.25 : 0), 3),
    ])) as Partial<Record<SectorId, number>>;
    if (Object.values(decayed).some((effect) => Math.abs(effect ?? 0) >= 0.01)) residuals[eventId] = decayed;
  }
  next.eventResiduals = residuals;
  next.history = [...state.history, { month: next.month, ...next.metrics }].slice(-60);
  next.causalHistory = [...state.causalHistory, { id: id(next, 'causal-month'), month: next.month, sectorChanges, metricChanges }].slice(-60);
  pruneEventHistory(next);
  updateRegions(next);
  return next;
}

export function advanceMonths(state: CountryState, months: number): CountryState {
  let next = structuredClone(state);
  const count = clamp(Math.floor(safeNumber(months, 0)), 0, 60);
  for (let i = 0; i < count; i += 1) next = advanceOneMonth(next);
  if (count > 0) next.actionHistory = [...next.actionHistory, { kind: 'advance', month: state.month, months: count }];
  return next;
}

export function changePolicy(state: CountryState, key: PolicyKey, value: number): CountryState {
  const next = structuredClone(state);
  const [min, max] = POLICY_BOUNDS[key];
  const safeValue = round(clamp(safeNumber(value, next.policies[key]), min, max), 2);
  next.policies = { ...next.policies, [key]: safeValue };
  next.actionHistory = [...next.actionHistory, { kind: 'policy', month: state.month, key, value: safeValue }];
  next.log = [...next.log, { id: id(next, 'policy'), month: state.month, title: `Policy changed: ${key}`, detail: `${key} set to ${safeValue}.` }].slice(-60);
  return next;
}

export function triggerEvent(state: CountryState, type: EventType, region: RegionId, severity = 1): CountryState {
  const next = structuredClone(state);
  const safeSeverity = round(clamp(safeNumber(severity, 1), 0.25, 2), 2);
  const durationMonths = Math.max(1, Math.round(EVENT_DURATION[type] * safeSeverity));
  const event: ActiveEvent = { id: id(next, 'event'), type, region, severity: safeSeverity, startedMonth: state.month, durationMonths, monthsRemaining: durationMonths };
  next.activeEvents = [...state.activeEvents, event];
  next.eventHistory = [...state.eventHistory, event];
  next.eventResiduals = { ...state.eventResiduals, [event.id]: Object.fromEntries(Object.entries(eventSectorImpact(event)).map(([sector, effect]) => [sector, Math.abs(effect ?? 0)])) as Partial<Record<SectorId, number>> };
  next.actionHistory = [...next.actionHistory, { kind: 'event', month: state.month, type, region, severity: safeSeverity, eventId: event.id }];
  next.log = [...next.log, { id: id(next, 'event-log'), month: state.month, title: `${EVENT_LABEL[type]} in ${state.regions[region].name}`, detail: `Severity ${safeSeverity.toFixed(1)} for ${durationMonths} months. Follow the causal chain in the monthly record.`, causes: [`event:${event.id}`, type, region] }].slice(-60);
  return next;
}

export function runCounterfactual(state: CountryState, label: string, months: number, policyPatch?: Partial<Policies>, event?: { type: EventType; region: RegionId; severity?: number }): CounterfactualResult {
  const appliedMonths = clamp(Math.floor(safeNumber(months, 0)), 0, 60);
  const baseline = advanceMonths(state, appliedMonths);
  let branch = structuredClone(state);
  if (policyPatch) for (const [key, value] of Object.entries(policyPatch) as [PolicyKey, number][]) branch = changePolicy(branch, key, value);
  if (event) branch = triggerEvent(branch, event.type, event.region, event.severity ?? 1);
  branch = advanceMonths(branch, appliedMonths);
  const delta = {} as CounterfactualResult['delta'];
  for (const key of METRICS) delta[key] = round(branch.metrics[key] - baseline.metrics[key], key === 'foodIndex' || key === 'energyIndex' || key === 'industrialOutput' || key === 'importsIndex' || key === 'exportsIndex' || key === 'confidence' ? 1 : 2);
  return { label, months: appliedMonths, start: structuredClone(state.metrics), baseline: structuredClone(baseline.metrics), end: structuredClone(branch.metrics), delta };
}
