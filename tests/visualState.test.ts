import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceMonths, triggerEvent } from '../src/economy/engine.ts';
import { initialCountryState } from '../src/economy/initialState.ts';
import { selectMetricCards, selectMetricExplanation, selectRegionInspector, selectTimeline, selectWorldVisualState } from '../src/economy/visualState.ts';

const fresh = () => structuredClone(initialCountryState);

test('visual selectors are deterministic and expose the full indicator strip', () => {
  const state = advanceMonths(triggerEvent(fresh(), 'oil_shock', 'energy', 1.2), 1);
  assert.deepEqual(selectMetricCards(state), selectMetricCards(state));
  assert.equal(selectMetricCards(state).length, 8);
  assert.equal(selectWorldVisualState(state).regions.energy.status, 'disrupted');
  assert.ok(selectWorldVisualState(state).activity.power < 1);
});

test('expired shocks become visible recovery signals', () => {
  const state = advanceMonths(triggerEvent(fresh(), 'drought', 'farmbelt'), 8);
  const visual = selectWorldVisualState(state).regions.farmbelt;
  assert.equal(state.activeEvents.length, 0);
  assert.equal(visual.status, 'recovering');
  assert.ok(visual.events.some((event) => !event.active));
});

test('WHY and region inspectors read causal metadata without changing state', () => {
  const state = advanceMonths(triggerEvent(fresh(), 'flood', 'port'), 1);
  const before = structuredClone(state);
  const why = selectMetricExplanation(state, 'importsIndex');
  const region = selectRegionInspector(state, 'port');
  const timeline = selectTimeline(state);
  assert.ok(why.contributors.length > 0);
  assert.equal(region.id, 'port');
  assert.ok(region.activeEffects.length > 0);
  assert.ok(timeline.some((item) => item.kind === 'event'));
  assert.deepEqual(state, before);
});
