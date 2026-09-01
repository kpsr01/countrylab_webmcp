import type { RoadNodeId } from './roadNetwork';

export type TrafficVehicleKind = 'car' | 'truck' | 'bus' | 'van';

export type RoadTrafficDefinition = {
  kind: TrafficVehicleKind;
  color: number;
  origin: RoadNodeId;
  destination: RoadNodeId;
  phase: number;
  speed: number;
  lane: number;
  threshold: number;
};

/**
 * Visual traffic deliberately stays on one authored painted-road corridor per
 * vehicle. Vehicles reverse at the end of that same corridor while fully faded,
 * so a semantic route change can never jump between disconnected map artwork.
 *
 * Only the four visually unambiguous road corridors carry traffic. The port
 * connector is intentionally excluded because it cuts across non-road terrain
 * in the painted map. Each opposing pair shares the same phase and speed, so
 * both vehicles reach opposite endpoints and reverse at the same time. This
 * preserves exactly one vehicle per direction and prevents bunching.
 */
export const ROAD_TRAFFIC_PLAN: readonly RoadTrafficDefinition[] = [
  { kind: 'car', color: 0x4fd9ff, origin: 'highlands', destination: 'capital', phase: 0.22, speed: 0.026, lane: 2.8, threshold: 0.02 },
  { kind: 'van', color: 0xe9eef0, origin: 'capital', destination: 'highlands', phase: 0.22, speed: 0.026, lane: 2.8, threshold: 0.18 },

  { kind: 'bus', color: 0xf4d260, origin: 'energy', destination: 'capital', phase: 0.26, speed: 0.021, lane: 2.8, threshold: 0.04 },
  { kind: 'car', color: 0x77e6c2, origin: 'capital', destination: 'energy', phase: 0.26, speed: 0.021, lane: 2.8, threshold: 0.22 },

  { kind: 'car', color: 0xf46f6f, origin: 'capital', destination: 'industrial', phase: 0.30, speed: 0.025, lane: 2.8, threshold: 0.05 },
  { kind: 'truck', color: 0xffb24f, origin: 'industrial', destination: 'capital', phase: 0.30, speed: 0.025, lane: 2.8, threshold: 0.27 },

  { kind: 'van', color: 0xffd467, origin: 'farms', destination: 'industrial', phase: 0.20, speed: 0.024, lane: 2.8, threshold: 0.12 },
  { kind: 'car', color: 0xff8e5d, origin: 'industrial', destination: 'farms', phase: 0.20, speed: 0.024, lane: 2.8, threshold: 0.31 },
];
