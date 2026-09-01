import { advanceMonths, changePolicy, triggerEvent } from './engine.ts';
import { initialCountryState } from './initialState.ts';
import type { CountryState, EventType, Policies, RegionId } from './types';

export type ScenarioAction =
  | { kind: 'event'; type: EventType; region: RegionId; severity?: number }
  | { kind: 'policy'; key: keyof Policies; value: number }
  | { kind: 'advance'; months: number };

export interface EconomicScenario {
  id: string;
  demoSlug: string;
  title: string;
  description: string;
  question: string;
  expectedBehavior: string;
  concepts: readonly string[];
  seed: number;
  actions: readonly ScenarioAction[];
}

export const economicScenarios: readonly EconomicScenario[] = [
  {
    id: 'port-flood',
    demoSlug: 'flood-crisis',
    title: 'Flooded Port',
    description: 'A severe flood closes South Port and interrupts imported supplies.',
    question: 'How does a damaged port reach prices and jobs?',
    expectedBehavior: 'Imports and trade fall, food and fuel prices rise, and unemployment follows.',
    concepts: ['Supply shock', 'Imports', 'Cost-push inflation'],
    seed: 1,
    actions: [{ kind: 'event', type: 'flood', region: 'port', severity: 1.5 }, { kind: 'advance', months: 6 }],
  },
  {
    id: 'energy-shock',
    demoSlug: 'oil-shock',
    title: 'Oil Shock',
    description: 'An energy shock raises fuel costs across the economy.',
    question: 'Can prices rise even while output falls?',
    expectedBehavior: 'Energy and industrial output fall while inflation and unemployment rise.',
    concepts: ['Cost-push inflation', 'Energy costs', 'Industrial output'],
    seed: 1,
    actions: [{ kind: 'event', type: 'oil_shock', region: 'energy', severity: 1.5 }, { kind: 'advance', months: 7 }],
  },
  {
    id: 'inflation-crisis',
    demoSlug: 'inflation-crisis',
    title: 'Inflation Crisis',
    description: 'An energy shock lifts prices before the central bank sharply raises rates.',
    question: 'What does fighting inflation cost in jobs and output?',
    expectedBehavior: 'Higher rates cool inflation with a delayed drag on GDP and employment.',
    concepts: ['Interest rates', 'Demand', 'Policy tradeoffs'],
    seed: 1,
    actions: [
      { kind: 'event', type: 'oil_shock', region: 'energy', severity: 1.75 },
      { kind: 'advance', months: 4 },
      { kind: 'policy', key: 'interestRate', value: 7 },
      { kind: 'advance', months: 8 },
    ],
  },
  {
    id: 'trade-war',
    demoSlug: 'trade-war',
    title: 'Trade War',
    description: 'Tariffs rise as conflict disrupts factories and cross-border trade.',
    question: 'Do tariffs protect output or mostly raise prices?',
    expectedBehavior: 'Imports contract, domestic production shifts, and price pressure builds.',
    concepts: ['Tariffs', 'Trade', 'Domestic production'],
    seed: 1,
    actions: [
      { kind: 'policy', key: 'tariffRate', value: 28 },
      { kind: 'event', type: 'war', region: 'industrial', severity: 1.25 },
      { kind: 'advance', months: 8 },
    ],
  },
  {
    id: 'food-drought',
    demoSlug: 'drought',
    title: 'Drought',
    description: 'A severe drought cuts harvests across the Greenbelt Farms.',
    question: 'How does a harvest failure reach households?',
    expectedBehavior: 'Food supply and rural output fall while food prices and unemployment rise.',
    concepts: ['Food supply', 'Rural employment', 'Scarcity'],
    seed: 1,
    actions: [{ kind: 'event', type: 'drought', region: 'farmbelt', severity: 1.5 }, { kind: 'advance', months: 8 }],
  },
  {
    id: 'productivity-boom',
    demoSlug: 'productivity-boom',
    title: 'Productivity Boom',
    description: 'New production methods make Ironworks dramatically more productive.',
    question: 'Can faster growth lower price pressure?',
    expectedBehavior: 'Output, exports and GDP rise while unemployment and inflation pressure ease.',
    concepts: ['Productivity', 'Potential output', 'Growth'],
    seed: 1,
    actions: [{ kind: 'event', type: 'productivity_boom', region: 'industrial', severity: 1.5 }, { kind: 'advance', months: 8 }],
  },
  {
    id: 'banking-crisis',
    demoSlug: 'banking-crisis',
    title: 'Banking Crisis',
    description: 'A credit freeze weakens lending and business confidence.',
    question: 'What happens when credit stops flowing?',
    expectedBehavior: 'Banking health, GDP and confidence fall while unemployment rises.',
    concepts: ['Credit', 'Confidence', 'Employment'],
    seed: 1,
    actions: [{ kind: 'event', type: 'banking_crisis', region: 'capital', severity: 1.5 }, { kind: 'advance', months: 6 }],
  },
];

export function findScenario(idOrSlug: string) {
  return economicScenarios.find((scenario) => scenario.id === idOrSlug || scenario.demoSlug === idOrSlug);
}

export interface ScenarioEventCheckpoint {
  eventId: string;
  country: CountryState;
}

export interface ScenarioRunWithCheckpoints {
  country: CountryState;
  eventCheckpoints: ScenarioEventCheckpoint[];
}

export function runScenarioWithCheckpoints(scenario: EconomicScenario, state: CountryState = initialCountryState): ScenarioRunWithCheckpoints {
  let next = structuredClone(state);
  const eventCheckpoints: ScenarioEventCheckpoint[] = [];
  for (const action of scenario.actions) {
    if (action.kind === 'event') {
      next = triggerEvent(next, action.type, action.region, action.severity);
      const event = next.eventHistory.at(-1);
      if (event) eventCheckpoints.push({ eventId: event.id, country: structuredClone(next) });
    }
    if (action.kind === 'policy') next = changePolicy(next, action.key, action.value);
    if (action.kind === 'advance') next = advanceMonths(next, action.months);
  }
  return { country: next, eventCheckpoints };
}

export function runScenario(scenario: EconomicScenario, state: CountryState = initialCountryState): CountryState {
  return runScenarioWithCheckpoints(scenario, state).country;
}
