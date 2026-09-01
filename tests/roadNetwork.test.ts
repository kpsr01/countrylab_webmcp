import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ROAD_NODE_IDS,
  nextRoadDestination,
  planRoadRoute,
  sampleRoadRoute,
} from '../src/game/roadNetwork.ts';

test('every district pair is connected by the authored road graph', () => {
  ROAD_NODE_IDS.forEach((origin) => {
    ROAD_NODE_IDS.forEach((destination) => {
      if (origin === destination) return;
      const route = planRoadRoute(origin, destination);
      assert.ok(route.length > 0);
      assert.equal(route.traversals[0].from, origin);
      assert.equal(route.traversals.at(-1)?.to, destination);
      route.traversals.slice(0, -1).forEach((traversal, index) => {
        assert.equal(traversal.to, route.traversals[index + 1].from);
      });
    });
  });
});

test('road samples remain finite, on-map and face the direction of travel', () => {
  ROAD_NODE_IDS.forEach((origin) => {
    ROAD_NODE_IDS.forEach((destination) => {
      if (origin === destination) return;
      const route = planRoadRoute(origin, destination);
      for (let distance = 0; distance < route.length - 2; distance += 4) {
        const sample = sampleRoadRoute(route, distance);
        const next = sampleRoadRoute(route, distance + 2);
        assert.ok(Number.isFinite(sample.x) && Number.isFinite(sample.y) && Number.isFinite(sample.rotation));
        assert.ok(sample.x >= 0 && sample.x <= 960 && sample.y >= 0 && sample.y <= 660);
        if (sample.edgeId !== next.edgeId) continue;
        const movementX = next.x - sample.x;
        const movementY = next.y - sample.y;
        const facingDot = movementX * Math.cos(sample.rotation) + movementY * Math.sin(sample.rotation);
        assert.ok(facingDot > -0.05, `${origin} to ${destination} points away from its movement at ${distance}`);
      }
    });
  });
});

test('lane offsets taper to road centerlines before every district junction', () => {
  const route = planRoadRoute('highlands', 'port');
  let boundary = 0;
  route.traversals.slice(0, -1).forEach((traversal) => {
    boundary += traversal.edge.length;
    const at = sampleRoadRoute(route, boundary, 2.1);
    assert.ok(at.distanceToJunction < 0.001);
  });
});

test('visual destination selection is deterministic and never chooses the same stop', () => {
  ROAD_NODE_IDS.forEach((current, seed) => {
    const first = nextRoadDestination(current, seed + 1, 3);
    const repeated = nextRoadDestination(current, seed + 1, 3);
    assert.equal(first, repeated);
    assert.notEqual(first, current);
  });
});
