export type MapPoint = readonly [number, number];

export type RoadNodeId = 'highlands' | 'farms' | 'energy' | 'capital' | 'industrial' | 'port';
export type RoadEdgeId =
  | 'highlands-capital'
  | 'energy-capital'
  | 'capital-industrial'
  | 'farms-industrial'
  | 'capital-port';

export type RoadEdge = {
  id: RoadEdgeId;
  from: RoadNodeId;
  to: RoadNodeId;
  points: MapPoint[];
  segmentLengths: number[];
  length: number;
};

export type RoadTraversal = {
  edge: RoadEdge;
  direction: 1 | -1;
  from: RoadNodeId;
  to: RoadNodeId;
};

export type PlannedRoadRoute = {
  origin: RoadNodeId;
  destination: RoadNodeId;
  traversals: RoadTraversal[];
  length: number;
};

export type RoadSample = {
  x: number;
  y: number;
  rotation: number;
  edgeId: RoadEdgeId;
  edgeDirection: 1 | -1;
  edgeProgress: number;
  distanceToJunction: number;
};

export const ROAD_NODE_IDS: readonly RoadNodeId[] = ['highlands', 'farms', 'energy', 'capital', 'industrial', 'port'];

// These centerlines are traced in the exact 960 x 660 Phaser coordinate space used
// by the rendered map. Extra points around bends stop vehicles from cutting across
// grass while still keeping the authored road artwork as the visual source of truth.
const edgeDefinitions: Record<RoadEdgeId, { from: RoadNodeId; to: RoadNodeId; points: MapPoint[] }> = {
  'highlands-capital': {
    from: 'highlands',
    to: 'capital',
    points: [
      [230, 194], [247, 188], [265, 183], [283, 181], [301, 182], [319, 185],
      [337, 190], [355, 196], [373, 203], [391, 211], [409, 220], [427, 229],
    ],
  },
  'energy-capital': {
    from: 'energy',
    to: 'capital',
    points: [
      [276, 371], [290, 373], [306, 373], [322, 370], [339, 364], [355, 356],
      [372, 347], [389, 338], [405, 332], [422, 327], [439, 323],
    ],
  },
  'capital-industrial': {
    from: 'capital',
    to: 'industrial',
    points: [
      [526, 332], [543, 339], [560, 347],
      [577, 355], [593, 363], [610, 371], [626, 379], [643, 386], [659, 393],
    ],
  },
  'farms-industrial': {
    from: 'farms',
    to: 'industrial',
    points: [
      [535, 100], [525, 110], [520, 125], [523, 140], [535, 153], [552, 162],
      [570, 170], [590, 180], [610, 190], [630, 200], [650, 210], [670, 220],
      [690, 230], [710, 240], [728, 252], [740, 265], [748, 280], [750, 292],
    ],
  },
  'capital-port': {
    from: 'capital',
    to: 'port',
    points: [
      [350, 469], [363, 474], [376, 480], [389, 487], [402, 494], [415, 501],
    ],
  },
};

function makeRoadEdge(id: RoadEdgeId): RoadEdge {
  const definition = edgeDefinitions[id];
  const segmentLengths = definition.points.slice(0, -1).map(([x, y], index) => {
    const [nextX, nextY] = definition.points[index + 1];
    return Math.hypot(nextX - x, nextY - y);
  });
  return {
    id,
    ...definition,
    segmentLengths,
    length: segmentLengths.reduce((sum, value) => sum + value, 0),
  };
}

export const ROAD_EDGES = Object.fromEntries(
  (Object.keys(edgeDefinitions) as RoadEdgeId[]).map((id) => [id, makeRoadEdge(id)]),
) as Record<RoadEdgeId, RoadEdge>;

type PreviousStep = { node: RoadNodeId; edgeId: RoadEdgeId; direction: 1 | -1 };

export function planRoadRoute(origin: RoadNodeId, destination: RoadNodeId): PlannedRoadRoute {
  if (origin === destination) return { origin, destination, traversals: [], length: 0 };

  const distances = Object.fromEntries(ROAD_NODE_IDS.map((node) => [node, Number.POSITIVE_INFINITY])) as Record<RoadNodeId, number>;
  const previous = new Map<RoadNodeId, PreviousStep>();
  const unvisited = new Set<RoadNodeId>(ROAD_NODE_IDS);
  distances[origin] = 0;

  while (unvisited.size) {
    let current: RoadNodeId | undefined;
    unvisited.forEach((node) => {
      if (!current || distances[node] < distances[current]) current = node;
    });
    if (!current || !Number.isFinite(distances[current])) break;
    unvisited.delete(current);
    if (current === destination) break;

    Object.values(ROAD_EDGES).forEach((edge) => {
      let neighbor: RoadNodeId | undefined;
      let direction: 1 | -1 = 1;
      if (edge.from === current) neighbor = edge.to;
      else if (edge.to === current) {
        neighbor = edge.from;
        direction = -1;
      }
      if (!neighbor || !unvisited.has(neighbor)) return;
      const candidate = distances[current!] + edge.length;
      if (candidate < distances[neighbor]) {
        distances[neighbor] = candidate;
        previous.set(neighbor, { node: current!, edgeId: edge.id, direction });
      }
    });
  }

  if (!previous.has(destination)) throw new Error(`No road route from ${origin} to ${destination}`);

  const reversed: RoadTraversal[] = [];
  let cursor = destination;
  while (cursor !== origin) {
    const step = previous.get(cursor);
    if (!step) throw new Error(`Incomplete road route from ${origin} to ${destination}`);
    reversed.push({ edge: ROAD_EDGES[step.edgeId], direction: step.direction, from: step.node, to: cursor });
    cursor = step.node;
  }
  const traversals = reversed.reverse();
  return {
    origin,
    destination,
    traversals,
    length: traversals.reduce((sum, traversal) => sum + traversal.edge.length, 0),
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function pointOnEdge(edge: RoadEdge, canonicalDistance: number) {
  let remaining = clamp(canonicalDistance, 0, edge.length);
  for (let index = 0; index < edge.segmentLengths.length; index += 1) {
    const segmentLength = edge.segmentLengths[index];
    if (remaining <= segmentLength || index === edge.segmentLengths.length - 1) {
      const [startX, startY] = edge.points[index];
      const [endX, endY] = edge.points[index + 1];
      const progress = segmentLength ? clamp(remaining / segmentLength, 0, 1) : 0;
      return { x: startX + (endX - startX) * progress, y: startY + (endY - startY) * progress };
    }
    remaining -= segmentLength;
  }
  const [x, y] = edge.points.at(-1)!;
  return { x, y };
}

function locateTraversal(route: PlannedRoadRoute, routeDistance: number) {
  let remaining = clamp(routeDistance, 0, route.length);
  for (let index = 0; index < route.traversals.length; index += 1) {
    const traversal = route.traversals[index];
    if (remaining <= traversal.edge.length || index === route.traversals.length - 1) {
      return { traversal, edgeProgress: clamp(remaining, 0, traversal.edge.length) };
    }
    remaining -= traversal.edge.length;
  }
  throw new Error(`Cannot sample empty road route from ${route.origin} to ${route.destination}`);
}

export function sampleRoadRoute(route: PlannedRoadRoute, routeDistance: number, laneOffset = 2.1): RoadSample {
  const distance = clamp(routeDistance, 0, route.length);
  const { traversal, edgeProgress } = locateTraversal(route, distance);
  const canonicalDistance = traversal.direction === 1
    ? edgeProgress
    : traversal.edge.length - edgeProgress;
  const center = pointOnEdge(traversal.edge, canonicalDistance);
  const look = 5;
  const before = pointOnEdge(
    traversal.edge,
    clamp(canonicalDistance - look * traversal.direction, 0, traversal.edge.length),
  );
  const after = pointOnEdge(
    traversal.edge,
    clamp(canonicalDistance + look * traversal.direction, 0, traversal.edge.length),
  );
  let dx = after.x - before.x;
  let dy = after.y - before.y;
  let magnitude = Math.hypot(dx, dy);
  if (magnitude < 0.001) {
    const fallback = traversal.direction === 1
      ? [traversal.edge.points[0], traversal.edge.points[1]]
      : [traversal.edge.points.at(-1)!, traversal.edge.points.at(-2)!];
    dx = fallback[1][0] - fallback[0][0];
    dy = fallback[1][1] - fallback[0][1];
    magnitude = Math.hypot(dx, dy) || 1;
  }

  // Merge to the painted centerline through junctions. This prevents the lane
  // normal from snapping sideways when a vehicle turns onto another road.
  const junctionTaper = Math.min(16, traversal.edge.length * 0.18);
  const laneStrength = clamp(Math.min(edgeProgress, traversal.edge.length - edgeProgress) / junctionTaper, 0, 1);
  const lane = laneOffset * laneStrength;
  return {
    x: center.x + (dy / magnitude) * lane,
    y: center.y - (dx / magnitude) * lane,
    rotation: Math.atan2(dy, dx),
    edgeId: traversal.edge.id,
    edgeDirection: traversal.direction,
    edgeProgress,
    distanceToJunction: Math.min(edgeProgress, traversal.edge.length - edgeProgress),
  };
}

export function nextRoadDestination(current: RoadNodeId, vehicleSeed: number, tripNumber: number): RoadNodeId {
  const currentIndex = ROAD_NODE_IDS.indexOf(current);
  const offset = 1 + ((vehicleSeed * 5 + tripNumber * 3) % (ROAD_NODE_IDS.length - 1));
  return ROAD_NODE_IDS[(currentIndex + offset) % ROAD_NODE_IDS.length];
}
