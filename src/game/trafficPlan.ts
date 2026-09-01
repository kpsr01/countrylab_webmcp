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
 * One vehicle travels each direction on each of the five traced corridors. The
 * phases are chosen so opposing vehicles start well apart instead of bunching at
 * a shared junction. The 2.8 px lane offset was checked against the rendered map.
 */
export const ROAD_TRAFFIC_PLAN: readonly RoadTrafficDefinition[] = [
  { kind: 'car', color: 0x4fd9ff, origin: 'highlands', destination: 'capital', phase: 0.22, speed: 0.027, lane: 2.8, threshold: 0.02 },
  { kind: 'bus', color: 0xf4d260, origin: 'energy', destination: 'capital', phase: 0.58, speed: 0.019, lane: 2.8, threshold: 0.04 },
  { kind: 'car', color: 0xf46f6f, origin: 'capital', destination: 'industrial', phase: 0.38, speed: 0.030, lane: 2.8, threshold: 0.05 },
  { kind: 'truck', color: 0x79d7a9, origin: 'capital', destination: 'port', phase: 0.64, speed: 0.019, lane: 2.8, threshold: 0.06 },
  { kind: 'van', color: 0xffd467, origin: 'farms', destination: 'industrial', phase: 0.24, speed: 0.024, lane: 2.8, threshold: 0.12 },
  { kind: 'van', color: 0xe9eef0, origin: 'capital', destination: 'highlands', phase: 0.34, speed: 0.024, lane: 2.8, threshold: 0.18 },
  { kind: 'car', color: 0x77e6c2, origin: 'capital', destination: 'energy', phase: 0.78, speed: 0.029, lane: 2.8, threshold: 0.22 },
  { kind: 'truck', color: 0xffb24f, origin: 'industrial', destination: 'capital', phase: 0.18, speed: 0.020, lane: 2.8, threshold: 0.27 },
  { kind: 'car', color: 0xff8e5d, origin: 'industrial', destination: 'farms', phase: 0.30, speed: 0.028, lane: 2.8, threshold: 0.31 },
  { kind: 'bus', color: 0x6ed0ff, origin: 'port', destination: 'capital', phase: 0.78, speed: 0.018, lane: 2.8, threshold: 0.36 },
];
