import assert from 'node:assert/strict';
import test from 'node:test';
import { initialCountryState } from '../src/economy/initialState.ts';
import { economicScenarios, findScenario, runScenario } from '../src/economy/scenarios.ts';
import { createCountryLabService } from '../src/application/countryLabService.ts';

const featured = economicScenarios.filter((scenario) => scenario.id !== 'banking-crisis');

test('featured presets are deterministic and produce bounded outcomes', () => {
  for (const scenario of featured) {
    const first = runScenario(scenario);
    const second = runScenario(scenario);
    assert.deepEqual(first, second, scenario.id);
    assert.ok(first.history.length <= 60, scenario.id);
    assert.ok(first.causalHistory.length <= 60, scenario.id);
    assert.ok(first.log.length <= 60, scenario.id);
    assert.ok(first.eventHistory.length > 0, scenario.id);
  }
});

test('demo slugs resolve to the same deterministic preset', () => {
  assert.equal(findScenario('flood-crisis')?.id, 'port-flood');
  assert.equal(findScenario('oil-shock')?.id, 'energy-shock');
  assert.equal(findScenario('inflation-crisis')?.id, 'inflation-crisis');
  assert.equal(findScenario('trade-war')?.id, 'trade-war');
});

test('application service owns independent state and exposes causal reads', () => {
  const service = createCountryLabService(initialCountryState);
  const before = service.getCountryState();
  const after = service.triggerEvent('flood', 'port', 1.5);
  service.advanceMonths(2);
  assert.equal(before.activeEvents.length, 0);
  assert.ok(after.activeEvents.length > 0);
  assert.ok(service.getEventHistory().length > 0);
  assert.ok(service.getCausalHistory().length > 0);
  const detached = service.getCountryState();
  detached.metrics.gdp = 999;
  assert.notEqual(service.getCountryState().metrics.gdp, 999);
  after.metrics.gdp = 999;
  assert.notEqual(service.getCountryState().metrics.gdp, 999);
});
