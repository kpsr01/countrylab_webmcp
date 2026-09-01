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
 * Sparse visual traffic stays on four corridors that were traced directly over
 * unambiguous painted roads in the rendered 960 x 660 map. Each corridor gets
 * one vehicle in each direction with matched phase/speed, so the pair stays
 * separated instead of collecting at a shared endpoint.
 */
export const ROAD_TRAFFIC_PLAN: readonly RoadTrafficDefinition[] = [
  { kind: 'car', color: 0x4fd9ff, origin: 'highlands', destination: 'capital', phase: 0.25, speed: 0.026, lane: 2.8, threshold: 0.02 },
  { kind: 'van', color: 0xffd467, origin: 'capital', destination: 'highlands', phase: 0.25, speed: 0.026, lane: 2.8, threshold: 0.12 },
  { kind: 'bus', color: 0xf4d260, origin: 'energy', destination: 'capital', phase: 0.25, speed: 0.021, lane: 2.8, threshold: 0.04 },
  { kind: 'car', color: 0x77e6c2, origin: 'capital', destination: 'energy', phase: 0.25, speed: 0.021, lane: 2.8, threshold: 0.18 },
  { kind: 'truck', color: 0xffb24f, origin: 'farms', destination: 'industrial', phase: 0.20, speed: 0.024, lane: 2.8, threshold: 0.05 },
  { kind: 'van', color: 0xe9eef0, origin: 'industrial', destination: 'farms', phase: 0.20, speed: 0.024, lane: 2.8, threshold: 0.15 },
  { kind: 'truck', color: 0x79d7a9, origin: 'capital', destination: 'port', phase: 0.25, speed: 0.018, lane: 2.8, threshold: 0.08 },
  { kind: 'bus', color: 0x6ed0ff, origin: 'port', destination: 'capital', phase: 0.25, speed: 0.018, lane: 2.8, threshold: 0.28 },
];
