import type { CountryState, RegionId, SectorId } from './types';

const regions: Record<RegionId, CountryState['regions'][RegionId]> = {
  capital: { id: 'capital', name: 'Capital District', health: 100, productivity: 100 },
  farmbelt: { id: 'farmbelt', name: 'Greenbelt Farms', health: 100, productivity: 100 },
  industrial: { id: 'industrial', name: 'Ironworks', health: 100, productivity: 100 },
  port: { id: 'port', name: 'South Port', health: 100, productivity: 100 },
  energy: { id: 'energy', name: 'Energy Basin', health: 100, productivity: 100 },
};

const sector = (id: SectorId, name: string, output: number): CountryState['sectors'][SectorId] => ({
  id,
  name,
  capacity: 100,
  output,
  health: 100,
  causalRoots: [],
});

export const initialCountryState: CountryState = {
  month: 1,
  nextId: 1,
  metrics: {
    gdp: 100,
    inflation: 2.4,
    unemployment: 5.2,
    debtPct: 44,
    foodIndex: 100,
    energyIndex: 100,
    industrialOutput: 100,
    importsIndex: 100,
    exportsIndex: 100,
    confidence: 64,
  },
  policies: {
    interestRate: 3.5,
    incomeTax: 22,
    corporateTax: 20,
    governmentSpending: 50,
    tariffRate: 5,
    emergencySpending: 0,
  },
  sectors: {
    households: sector('households', 'Households', 100),
    agriculture: sector('agriculture', 'Agriculture', 100),
    manufacturing: sector('manufacturing', 'Manufacturing', 100),
    energy: sector('energy', 'Energy', 100),
    trade: sector('trade', 'Trade & logistics', 100),
    banking: sector('banking', 'Banking', 100),
    government: sector('government', 'Government', 100),
    central_bank: sector('central_bank', 'Central bank', 100),
  },
  regions,
  activeEvents: [],
  eventHistory: [],
  history: [],
  causalHistory: [],
  metricRoots: {},
  causalBranches: {},
  eventResiduals: {},
  actionHistory: [],
  log: [{
    id: 'log-0',
    month: 1,
    title: 'Country initialized',
    detail: 'A stable small economy is ready for deterministic experiments.',
  }],
};
