import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceMonths, changePolicy, triggerEvent } from '../src/economy/engine.ts';
import { createBranch, createSnapshot, duplicateBranch, restoreSnapshot, runCounterfactual } from '../src/economy/counterfactual.ts';
import { initialCountryState } from '../src/economy/initialState.ts';

const fresh = () => structuredClone(initialCountryState);

test('snapshot restore reproduces the complete country state', () => {
  const country = advanceMonths(triggerEvent(fresh(), 'flood', 'port'), 2);
  const snapshot = createSnapshot(country, 'Test point', 'manual', undefined, 'snapshot-test');
  assert.deepEqual(restoreSnapshot(snapshot), country);
  const restored = restoreSnapshot(snapshot);
  restored.metrics.gdp = 1;
  assert.notEqual(restored.metrics.gdp, snapshot.country.metrics.gdp);
});

test('identical branches remain identical and isolated', () => {
  const snapshot = createSnapshot(triggerEvent(fresh(), 'oil_shock', 'energy'), 'Oil shock', 'event', 'event-1', 'snapshot-oil');
  const first = createBranch(snapshot, 'A', 'branch-a');
  const second = duplicateBranch(first, 'branch-b');
  const a = runCounterfactual({ baseSnapshot: first.baseSnapshot, intervention: { kind: 'event', action: 'remove', eventId: 'event-1' }, months: 8, id: 'comparison-a' });
  const b = runCounterfactual({ baseSnapshot: second.baseSnapshot, intervention: { kind: 'event', action: 'remove', eventId: 'event-1' }, months: 8, id: 'comparison-b' });
  assert.deepEqual(a.counterfactual.finalState, b.counterfactual.finalState);
  assert.deepEqual(a.metricDifferences, b.metricDifferences);
  second.baseSnapshot.country.metrics.gdp = 999;
  assert.notEqual(second.baseSnapshot.country.metrics.gdp, first.baseSnapshot.country.metrics.gdp);
});

test('removing an event diverges only the alternate scenario and keeps both histories separate', () => {
  const affected = triggerEvent(fresh(), 'flood', 'port');
  const snapshot = createSnapshot(affected, 'Flood point', 'event', affected.eventHistory[0].id, 'snapshot-flood');
  const comparison = runCounterfactual({ baseSnapshot: snapshot, intervention: { kind: 'event', action: 'remove', eventId: affected.eventHistory[0].id }, months: 6, id: 'comparison-flood' });
  assert.ok(comparison.divergenceMonth !== null);
  assert.ok(comparison.metricDifferences.importsIndex.difference > 0);
  assert.ok(comparison.causalDifferences.some((difference) => difference.root.startsWith('event:')));
  comparison.counterfactual.finalState.metrics.gdp = 0;
  assert.notEqual(comparison.counterfactual.finalState.metrics.gdp, comparison.baseline.finalState.metrics.gdp);
});

test('policy interventions and repeated runs are deterministic', () => {
  const snapshot = createSnapshot(fresh(), 'Stable point', 'manual', undefined, 'snapshot-policy');
  const options = { baseSnapshot: snapshot, intervention: { kind: 'policy' as const, key: 'interestRate' as const, value: 8 }, months: 12, id: 'comparison-rates' };
  const first = runCounterfactual(options);
  const second = runCounterfactual(options);
  assert.deepEqual(first, second);
  assert.ok(first.metricDifferences.inflation.difference < 0);
});

test('severity interventions update aliased event records once', () => {
  const affected = triggerEvent(fresh(), 'flood', 'port');
  const snapshot = createSnapshot(affected, 'Flood point', 'event', affected.eventHistory[0].id, 'snapshot-severity');
  const comparison = runCounterfactual({ baseSnapshot: snapshot, intervention: { kind: 'eventSeverity', eventId: 'event-1', severity: 2 }, months: 1, id: 'comparison-severity' });
  assert.equal(comparison.counterfactual.startState.activeEvents[0].durationMonths, 10);
  assert.equal(comparison.counterfactual.startState.eventHistory[0].durationMonths, 10);
  assert.equal(comparison.timelinesDiverged, true);
});

test('preset scenario execution exposes an event checkpoint before later consequences accumulate', async () => {
  const { findScenario, runScenarioWithCheckpoints } = await import('../src/economy/scenarios.ts');
  const scenario = findScenario('port-flood');
  assert.ok(scenario);
  const result = runScenarioWithCheckpoints(scenario, fresh());
  assert.equal(result.eventCheckpoints.length, 1);
  assert.equal(result.eventCheckpoints[0].country.month, 1);
  assert.ok(result.country.month > result.eventCheckpoints[0].country.month);
  assert.equal(result.eventCheckpoints[0].eventId, result.country.eventHistory[0].id);
});


test('event counterfactuals replay later live interventions at their original points in time', () => {
  let live = triggerEvent(fresh(), 'oil_shock', 'energy', 1.5);
  const event = live.eventHistory[0];
  const snapshot = createSnapshot(live, 'Oil shock checkpoint', 'event', event.id, 'snapshot-replay');
  live = advanceMonths(live, 4);
  live = changePolicy(live, 'interestRate', 7);
  live = advanceMonths(live, 8);

  const replayActions = live.actionHistory.slice(snapshot.country.actionHistory.length);
  const comparison = runCounterfactual({
    baseSnapshot: snapshot,
    intervention: { kind: 'event', action: 'remove', eventId: event.id, eventType: event.type, region: event.region },
    months: 12,
    replayActions,
    id: 'comparison-replay',
  });

  assert.deepEqual(comparison.baseline.finalState.metrics, live.metrics);
  assert.equal(comparison.baseline.finalState.policies.interestRate, 7);
  assert.equal(comparison.counterfactual.finalState.policies.interestRate, 7);
  assert.equal(comparison.counterfactual.startState.actionHistory.some((action) => action.kind === 'event' && action.eventId === event.id), false);
  assert.ok(comparison.timelinesDiverged);
});

test('counterfactual execution honors an aborted signal', () => {
  const controller = new AbortController();
  controller.abort(new Error('cancelled by test'));
  const snapshot = createSnapshot(fresh(), 'Cancellation point', 'manual', undefined, 'snapshot-cancel');
  assert.throws(
    () => runCounterfactual({ baseSnapshot: snapshot, intervention: { kind: 'policy', key: 'interestRate', value: 8 }, months: 12, signal: controller.signal }),
    /cancelled by test/,
  );
});
