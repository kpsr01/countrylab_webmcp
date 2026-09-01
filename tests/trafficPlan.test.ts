import assert from 'node:assert/strict';
import test from 'node:test';
import { planRoadRoute, sampleRoadRoute } from '../src/game/roadNetwork.ts';
import { ROAD_TRAFFIC_PLAN } from '../src/game/trafficPlan.ts';

test('visual traffic uses exactly one vehicle per direction on each painted corridor', () => {
  assert.equal(ROAD_TRAFFIC_PLAN.length, 10);
  const byEdge = new Map<string, Array<{ direction: 1 | -1; canonicalPhase: number }>>();

  for (const definition of ROAD_TRAFFIC_PLAN) {
    const route = planRoadRoute(definition.origin, definition.destination);
    assert.equal(route.traversals.length, 1, `${definition.origin} -> ${definition.destination} must stay on one painted corridor`);
    const traversal = route.traversals[0];
    const canonicalPhase = traversal.direction === 1 ? definition.phase : 1 - definition.phase;
    const entries = byEdge.get(traversal.edge.id) ?? [];
    entries.push({ direction: traversal.direction, canonicalPhase });
    byEdge.set(traversal.edge.id, entries);
  }

  assert.equal(byEdge.size, 5);
  for (const [edgeId, entries] of byEdge) {
    assert.equal(entries.length, 2, `${edgeId} should have two vehicles total`);
    assert.deepEqual(new Set(entries.map((entry) => entry.direction)), new Set([1, -1]), `${edgeId} should have opposing traffic`);
    assert.ok(Math.abs(entries[0].canonicalPhase - entries[1].canonicalPhase) >= 0.3, `${edgeId} vehicles should start well separated`);
  }
});

test('fixed-corridor turnarounds are position-continuous and remain on the traced lane', () => {
  for (const definition of ROAD_TRAFFIC_PLAN) {
    const forward = planRoadRoute(definition.origin, definition.destination);
    const reverse = planRoadRoute(definition.destination, definition.origin);
    const end = sampleRoadRoute(forward, forward.length, definition.lane);
    const restart = sampleRoadRoute(reverse, 0, definition.lane);

    assert.ok(Math.abs(end.x - restart.x) < 0.001, `${definition.origin} -> ${definition.destination} turnaround x must not jump`);
    assert.ok(Math.abs(end.y - restart.y) < 0.001, `${definition.origin} -> ${definition.destination} turnaround y must not jump`);

    for (let step = 0; step <= 20; step += 1) {
      const sample = sampleRoadRoute(forward, forward.length * (step / 20), definition.lane);
      assert.ok(Number.isFinite(sample.x) && Number.isFinite(sample.y) && Number.isFinite(sample.rotation));
      assert.equal(sample.edgeId, forward.traversals[0].edge.id);
    }
  }
});
