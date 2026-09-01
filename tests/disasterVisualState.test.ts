import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceMonths, triggerEvent } from '../src/economy/engine.ts';
import { initialCountryState } from '../src/economy/initialState.ts';
import { selectDisasterWorldPresentation } from '../src/economy/disasterVisualState.ts';

const fresh = () => structuredClone(initialCountryState);

function numericLeaves(value: unknown): number[] {
  if (typeof value === 'number') return [value];
  if (!value || typeof value !== 'object') return [];
  return Object.values(value).flatMap(numericLeaves);
}

test('disaster presentation is deterministic, finite, and normalized', () => {
  const state = advanceMonths(triggerEvent(fresh(), 'oil_shock', 'energy', 1.2), 1);
  const first = selectDisasterWorldPresentation(state);
  const second = selectDisasterWorldPresentation(state);
  assert.deepEqual(first, second);
  for (const value of numericLeaves(first)) {
    assert.ok(Number.isFinite(value));
    assert.ok(value >= 0 && value <= 1, `expected normalized value, got ${value}`);
  }
});

test('port flood makes actual trade loss visible as lower shipping and cargo throughput', () => {
  const baseline = selectDisasterWorldPresentation(fresh());
  const state = advanceMonths(triggerEvent(fresh(), 'flood', 'port', 1.2), 1);
  const visual = selectDisasterWorldPresentation(state);
  assert.ok(visual.activity.shipping < baseline.activity.shipping);
  assert.ok(visual.regions.port.disruption > baseline.regions.port.disruption);
  assert.equal(visual.regions.port.mainEvent?.type, 'flood');
  assert.ok((visual.regions.port.mainEvent?.intensity ?? 0) > 0);
});

test('drought recovery restores visible agricultural activity and reduces disruption', () => {
  const impactedState = advanceMonths(triggerEvent(fresh(), 'drought', 'farmbelt'), 1);
  const recoveredState = advanceMonths(impactedState, 12);
  const impacted = selectDisasterWorldPresentation(impactedState);
  const recovered = selectDisasterWorldPresentation(recoveredState);
  assert.ok(recovered.activity.agriculture > impacted.activity.agriculture);
  assert.ok(recovered.regions.farmbelt.disruption < impacted.regions.farmbelt.disruption);
  assert.notEqual(recovered.regions.farmbelt.phase, 'impact');
});

test('productivity boom increases factory presentation instead of using negative disruption semantics', () => {
  const baseline = selectDisasterWorldPresentation(fresh());
  const state = advanceMonths(triggerEvent(fresh(), 'productivity_boom', 'industrial'), 1);
  const visual = selectDisasterWorldPresentation(state);
  assert.ok(visual.activity.factory > baseline.activity.factory);
  assert.equal(visual.regions.industrial.mainEvent?.type, 'productivity_boom');
});
