import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceMonths, changePolicy, runCounterfactual, triggerEvent } from '../src/economy/engine.ts';
import { initialCountryState } from '../src/economy/initialState.ts';
import { economicScenarios, runScenario } from '../src/economy/scenarios.ts';
import type { CountryState, MetricKey } from '../src/economy/types.ts';

const fresh = () => structuredClone(initialCountryState);
const totalEffect = (contributors: { effect: number }[]) => Number(contributors.reduce((sum, item) => sum + item.effect, 0).toFixed(2));

function metricChange(state: CountryState, metric: MetricKey) {
  return state.causalHistory.at(-1)?.metricChanges.find((change) => change.metric === metric);
}

test('replaying the same actions produces identical state', () => {
  const run = () => {
    let state = fresh();
    state = changePolicy(state, 'interestRate', 7);
    state = triggerEvent(state, 'flood', 'port', 1.25);
    return advanceMonths(state, 6);
  };
  assert.deepEqual(run(), run());
});

test('months are discrete and events remain historically inspectable after expiry', () => {
  const withEvent = triggerEvent(fresh(), 'drought', 'farmbelt', 1);
  const after = advanceMonths(withEvent, 8);
  assert.equal(after.month, 9);
  assert.equal(after.activeEvents.length, 0);
  assert.equal(after.eventHistory.length, 1);
  assert.equal(after.causalHistory.length, 8);
  assert.equal(after.history.length, 8);
});

test('flood records the ordered imports-to-food path into inflation', () => {
  const state = advanceMonths(triggerEvent(fresh(), 'flood', 'port', 1.5), 1);
  const eventId = state.eventHistory[0].id;
  const inflation = metricChange(state, 'inflation');
  const food = metricChange(state, 'foodIndex');
  assert.ok(inflation);
  assert.ok(food);
  const foodPath = food.contributors.find((item) => item.chain.includes(`event:${eventId}`) && item.chain.includes('metric:importsIndex'))?.chain ?? [];
  assert.ok(foodPath.indexOf(`event:${eventId}`) < foodPath.indexOf('sector:trade'));
  assert.ok(foodPath.indexOf('sector:trade') < foodPath.indexOf('metric:importsIndex'));
  assert.ok(foodPath.indexOf('metric:importsIndex') < foodPath.indexOf('metric:foodIndex'));
  assert.ok(inflation.contributors.some((item) => item.chain.includes(`event:${eventId}`) && item.chain.includes('metric:foodIndex')));
  assert.equal(totalEffect(inflation.contributors), inflation.delta);
});

test('regional event placement changes sector outcomes', () => {
  const portFlood = advanceMonths(triggerEvent(fresh(), 'flood', 'port'), 1);
  const capitalFlood = advanceMonths(triggerEvent(fresh(), 'flood', 'capital'), 1);
  assert.notEqual(portFlood.sectors.trade.capacity, capitalFlood.sectors.trade.capacity);
  assert.ok(portFlood.sectors.trade.capacity < capitalFlood.sectors.trade.capacity);
});

test('stacked shocks preserve both food causal roots', () => {
  let state = fresh();
  state = triggerEvent(state, 'flood', 'port');
  state = triggerEvent(state, 'drought', 'farmbelt');
  state = advanceMonths(state, 1);
  const eventIds = state.eventHistory.map((event) => `event:${event.id}`);
  const food = metricChange(state, 'foodIndex');
  const inflation = metricChange(state, 'inflation');
  assert.ok(food && inflation);
  assert.ok(food.contributors.some((item) => item.roots.includes(eventIds[0])));
  assert.ok(food.contributors.some((item) => item.roots.includes(eventIds[1])));
  assert.ok(inflation.contributors.some((item) => item.roots.includes(eventIds[0])));
  assert.ok(inflation.contributors.some((item) => item.roots.includes(eventIds[1])));
});
test('parallel shocks never appear as one directed path', () => {
  let state = fresh();
  state = triggerEvent(state, 'flood', 'port');
  state = triggerEvent(state, 'drought', 'farmbelt');
  state = advanceMonths(state, 1);
  for (const change of state.causalHistory[0].metricChanges) {
    for (const contributor of change.contributors) assert.ok(contributor.chain.filter((node) => node.startsWith('event:')).length <= 1);
  }
});

test('lagging metrics retain expired event provenance', () => {
  let state = triggerEvent(fresh(), 'flood', 'port');
  const eventId = `event:${state.activeEvents[0].id}`;
  state = advanceMonths(state, 8);
  const inflation = metricChange(state, 'inflation');
  assert.ok(inflation?.contributors.some((contributor) => contributor.roots.includes(eventId)));
});

test('capacity policy roots flow into sector output', () => {
  const state = advanceMonths(changePolicy(fresh(), 'incomeTax', 40), 1);
  const output = state.causalHistory[0].sectorChanges.find((change) => change.sector === 'households' && change.field === 'output');
  assert.ok(output?.contributors.some((contributor) => contributor.roots.includes('policy:incomeTax')));
});

test('each selectable region changes a flood trajectory', () => {
  const trajectories = (['capital', 'industrial', 'energy'] as const)
    .map((region) => advanceMonths(triggerEvent(fresh(), 'flood', region), 1).metrics.gdp);
  assert.equal(new Set(trajectories).size, trajectories.length);
});


test('sector output records policy and upstream causes', () => {
  const state = advanceMonths(changePolicy(fresh(), 'interestRate', 8), 1);
  const household = state.causalHistory[0].sectorChanges.find((change) => change.sector === 'households' && change.field === 'output');
  assert.ok(household);
  assert.ok(household.contributors.some((item) => item.chain.includes('policy:interestRate')));
  assert.ok(state.causalHistory[0].sectorChanges.every((change) => Math.abs(totalEffect(change.contributors) - change.delta) < 0.01));
});

test('expired shocks retain provenance during recovery', () => {
  const state = advanceMonths(triggerEvent(fresh(), 'flood', 'port'), 6);
  const eventId = `event:${state.eventHistory[0].id}`;
  const tradeRecovery = state.causalHistory.at(-1)?.sectorChanges.find((change) => change.sector === 'trade' && change.field === 'output');
  assert.equal(state.activeEvents.length, 0);
  assert.ok(tradeRecovery?.contributors.some((item) => item.chain.includes(eventId)));
});

test('counterfactuals compare isolated futures and return detached metrics', () => {
  const state = advanceMonths(triggerEvent(fresh(), 'flood', 'port'), 1);
  const expectedBaseline = advanceMonths(state, 4);
  const result = runCounterfactual(state, 'Higher rates', 4, { interestRate: 8 });
  assert.deepEqual(result.baseline, expectedBaseline.metrics);
  assert.deepEqual(result.start, state.metrics);
  result.start.gdp = -999;
  result.end.gdp = -999;
  assert.notEqual(state.metrics.gdp, -999);
});

test('sector shocks create understandable directional behavior', () => {
  const energy = runScenario(economicScenarios.find((scenario) => scenario.id === 'energy-shock')!);
  const banking = runScenario(economicScenarios.find((scenario) => scenario.id === 'banking-crisis')!);
  const boom = runScenario(economicScenarios.find((scenario) => scenario.id === 'productivity-boom')!);
  assert.ok(energy.metrics.energyIndex < 100);
  assert.ok(energy.metrics.industrialOutput < 100);
  assert.ok(banking.sectors.banking.health < 100);
  assert.ok(banking.metrics.confidence < 64);
  assert.ok(banking.metrics.unemployment > 5.2);
  assert.ok(boom.metrics.industrialOutput > 100);
  assert.ok(boom.metrics.exportsIndex > 100);
  assert.ok(boom.metrics.gdp > 100);
});

test('all predefined scenarios produce bounded causal histories', () => {
  for (const scenario of economicScenarios) {
    const state = runScenario(scenario);
    assert.ok(state.causalHistory.length > 0, scenario.id);
    assert.ok(state.history.length > 0, scenario.id);
    for (const value of Object.values(state.metrics)) assert.ok(Number.isFinite(value), scenario.id);
  }
});

test('retained causal records keep their event sources', () => {
  let state = fresh();
  for (let index = 0; index < 121; index += 1) state = triggerEvent(state, 'flood', 'port');
  state = advanceMonths(state, 1);
  const firstEvent = state.eventHistory[0];
  const firstCausalSource = state.causalHistory[0].sectorChanges
    .find((change) => change.sector === 'trade' && change.field === 'capacity')
    ?.contributors.find((contributor) => contributor.sourceType === 'event')?.sourceId;
  assert.ok(firstEvent);
  assert.equal(firstCausalSource, `event:${firstEvent.id}`);
  assert.ok(state.eventHistory.length >= 121);
});

test('unemployment recovers after temporary shock pressure fades', () => {
  const shocked = advanceMonths(triggerEvent(fresh(), 'banking_crisis', 'capital'), 6);
  const recovered = advanceMonths(shocked, 60);
  assert.ok(recovered.metrics.unemployment < shocked.metrics.unemployment);
});

test('policies and long runs stay within educational bounds', () => {
  let state = changePolicy(fresh(), 'emergencySpending', 999);
  state = changePolicy(state, 'corporateTax', -10);
  state = triggerEvent(state, 'war', 'industrial', 999);
  state = advanceMonths(state, 60);
  assert.equal(state.policies.emergencySpending, 100);
  assert.equal(state.policies.corporateTax, 0);
  assert.ok(state.activeEvents.length === 0 || state.activeEvents.every((event) => event.monthsRemaining > 0));
  for (const value of Object.values(state.metrics)) assert.ok(Number.isFinite(value));
  assert.ok(state.metrics.gdp >= 35 && state.metrics.gdp <= 220);
  assert.ok(state.metrics.inflation >= -1 && state.metrics.inflation <= 25);
  for (const sector of Object.values(state.sectors)) {
    assert.ok(sector.capacity >= 20 && sector.capacity <= 125);
    assert.ok(sector.output >= 25 && sector.output <= 130);
    assert.ok(sector.health >= 20 && sector.health <= 125);
  }
});
