import * as Phaser from 'phaser';
import { useGameStore } from '../store/useGameStore';
import type { RegionId } from '../economy/types';
import { REGION_PRESENTATION, WORLD_ENTITIES } from './worldModel';
import { EVENT_PRESENTATION, selectWorldVisualState, type RegionVisualState } from '../economy/visualState';
import {
  planRoadRoute,
  sampleRoadRoute,
  type PlannedRoadRoute,
  type RoadNodeId,
  type RoadSample,
} from './roadNetwork';
import { ROAD_TRAFFIC_PLAN, type TrafficVehicleKind } from './trafficPlan';

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 660;

type MapPoint = [number, number];
type RegionLayout = {
  points: MapPoint[];
  hitArea: MapPoint[];
  anchor: MapPoint;
  bounds: { x: number; y: number; w: number; h: number };
  accent: number;
};

type RegionView = {
  outline: Phaser.GameObjects.Graphics;
  effect: Phaser.GameObjects.Graphics;
  badge: Phaser.GameObjects.Graphics;
  status: Phaser.GameObjects.Text;
  label: Phaser.GameObjects.Text;
};

type RoadVehicle = {
  container: Phaser.GameObjects.Container;
  kind: TrafficVehicleKind;
  origin: RoadNodeId;
  destination: RoadNodeId;
  route: PlannedRoadRoute;
  distance: number;
  baseSpeed: number;
  actualSpeed: number;
  laneOffset: number;
  visibilityThreshold: number;
  activityAlpha: number;
  sample: RoadSample;
};

const regionLayout: Record<RegionId, RegionLayout> = {
  farmbelt: {
    points: [[485, 44], [805, 35], [913, 160], [850, 286], [666, 310], [524, 247]],
    hitArea: [[492, 38], [816, 34], [920, 154], [854, 292], [670, 315], [515, 250]],
    anchor: [704, 92], bounds: { x: 492, y: 42, w: 410, h: 265 }, accent: 0xa9d96a,
  },
  energy: {
    points: [[38, 250], [235, 232], [420, 332], [430, 476], [286, 573], [55, 526]],
    hitArea: [[25, 245], [238, 220], [433, 330], [441, 487], [292, 587], [38, 535]],
    anchor: [180, 322], bounds: { x: 35, y: 225, w: 395, h: 350 }, accent: 0x70d7b2,
  },
  capital: {
    points: [[284, 192], [508, 158], [669, 249], [650, 420], [480, 485], [300, 405]],
    hitArea: [[273, 185], [515, 151], [679, 245], [660, 428], [480, 494], [291, 411]],
    anchor: [476, 236], bounds: { x: 280, y: 155, w: 390, h: 330 }, accent: 0x7fcdec,
  },
  industrial: {
    points: [[622, 242], [868, 236], [924, 405], [816, 520], [627, 475], [570, 346]],
    hitArea: [[615, 230], [880, 229], [935, 407], [822, 532], [615, 484], [559, 342]],
    anchor: [783, 321], bounds: { x: 572, y: 232, w: 355, h: 290 }, accent: 0xffa66f,
  },
  port: {
    points: [[279, 452], [552, 420], [794, 482], [781, 635], [474, 650], [265, 580]],
    hitArea: [[270, 443], [555, 410], [805, 478], [796, 651], [470, 659], [252, 590]],
    anchor: [552, 515], bounds: { x: 264, y: 418, w: 530, h: 230 }, accent: 0x4fd4e4,
  },
};

const regionOrder: RegionId[] = ['farmbelt', 'energy', 'capital', 'industrial', 'port'];
const toPoints = (points: MapPoint[]) => points.map(([x, y]) => new Phaser.Math.Vector2(x, y));

export class EconomyScene extends Phaser.Scene {
  private unsubscribe?: () => void;
  private regionViews = new Map<RegionId, RegionView>();
  private roadVehicles: RoadVehicle[] = [];
  private trafficActivity = 1;
  private motionEnabled = true;
  private ship?: Phaser.GameObjects.Container;
  private factorySmoke?: Phaser.GameObjects.Container;
  private powerGlow?: Phaser.GameObjects.Arc;
  private selectionPulse?: Phaser.GameObjects.Graphics;
  private worldReady = false;

  constructor() {
    super('economy');
  }

  preload() {
    this.load.image('lumenia-map', '/assets/reference/main-country-map.png');
  }

  create() {
    this.motionEnabled = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.cameras.main.setBackgroundColor('#07131f');
    this.buildMapBase();
    this.buildRegionViews();
    this.buildEntityMarkers();
    this.buildActivities();
    this.buildMapChrome();
    this.worldReady = true;
    this.syncWorldState();
    this.unsubscribe = useGameStore.subscribe(() => {
      try { this.syncWorldState(); } catch (error) { console.warn('[CountryLab] map sync skipped:', error); }
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribe?.());
  }

  private buildMapBase() {
    const map = this.add.image(CANVAS_WIDTH / 2, 315, 'lumenia-map').setDisplaySize(CANVAS_WIDTH, 720);
    map.setTint(0xc7dde0);

    const atmosphere = this.add.graphics();
    atmosphere.fillStyle(0x03111d, 0.08).fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    atmosphere.fillGradientStyle(0x04121e, 0x04121e, 0x04121e, 0x04121e, 0.38, 0.02, 0.02, 0.38);
    atmosphere.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    atmosphere.lineStyle(2, 0xa8edf2, 0.12);
    for (let y = 42; y < CANVAS_HEIGHT; y += 29) {
      atmosphere.beginPath().moveTo(16, y).lineTo(68, y - 5).strokePath();
      atmosphere.beginPath().moveTo(CANVAS_WIDTH - 76, y + 3).lineTo(CANVAS_WIDTH - 18, y - 3).strokePath();
    }
  }

  private buildRegionViews() {
    regionOrder.forEach((id) => {
      const layout = regionLayout[id];
      const outline = this.add.graphics();
      const effect = this.add.graphics();
      const badge = this.add.graphics();
      const label = this.add.text(layout.anchor[0], layout.anchor[1], REGION_PRESENTATION[id].label.toUpperCase(), {
        color: '#f7fbf4', fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold',
        stroke: '#07131f', strokeThickness: 4,
      }).setOrigin(0.5, 1);
      const status = this.add.text(layout.anchor[0], layout.anchor[1] + 8, '', {
        color: '#cde9e3', fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold',
      }).setOrigin(0.5, 0);

      const hitArea = new Phaser.Geom.Polygon(layout.hitArea.flat());
      const zone = this.add.zone(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
        .setOrigin(0)
        .setInteractive(hitArea, Phaser.Geom.Polygon.Contains);
      zone.setData('regionId', id);
      zone.on('pointerover', () => useGameStore.getState().highlightRegion(id));
      zone.on('pointerout', () => {
        const selected = useGameStore.getState().selectedRegion;
        useGameStore.getState().highlightRegion(selected);
      });
      zone.on('pointerdown', () => useGameStore.getState().selectRegion(id));

      this.regionViews.set(id, { outline, effect, badge, status, label });
    });

    this.selectionPulse = this.add.graphics();
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.tweens.add({ targets: this.selectionPulse, alpha: 0.35, duration: 900, repeat: -1, yoyo: true, ease: 'Sine.easeInOut' });
    }
  }

  private buildEntityMarkers() {
    const markerIds = new Set(['government-house', 'national-bank', 'civic-hospital']);
    WORLD_ENTITIES.filter((entity) => markerIds.has(entity.id)).forEach((entity) => {
      const shortLabel = entity.id === 'government-house' ? 'GOV' : entity.id === 'national-bank' ? 'BANK' : 'HOSP';
      const marker = this.add.container(entity.x, entity.y).setData('entityId', entity.id).setData('regionId', entity.regionId);
      const plate = this.add.graphics();
      plate.fillStyle(0x061521, 0.86).fillRoundedRect(-20, -9, 40, 18, 7);
      plate.lineStyle(1, 0xbceaf0, 0.62).strokeRoundedRect(-20, -9, 40, 18, 7);
      const text = this.add.text(0, 0, shortLabel, { color: '#e9fbf5', fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold' }).setOrigin(0.5);
      marker.add([plate, text]);
    });
  }

  private buildActivities() {
    this.buildRoadTraffic();

    this.ship = this.add.container(681, 594).setData('entityId', 'harbor-cargo-ship');
    const shipGraphic = this.add.graphics();
    shipGraphic.fillStyle(0xf1f5e8, 1).fillRoundedRect(-18, -6, 30, 9, 3);
    shipGraphic.fillStyle(0xe66c4b, 1).fillTriangle(-21, -4, 19, -4, 12, 6);
    shipGraphic.fillStyle(0x16384a, 1).fillRect(-7, -11, 12, 6);
    this.ship.add(shipGraphic);

    this.factorySmoke = this.add.container(795, 302).setData('entityId', 'ironworks-activity');
    [0, 1, 2].forEach((index) => {
      const puff = this.add.circle(index * 8, -index * 10, 5 + index * 2, 0xe7f0ed, 0.45 - index * 0.08);
      this.factorySmoke?.add(puff);
    });
    this.powerGlow = this.add.circle(190, 348, 26, 0x6fe3c0, 0.14).setStrokeStyle(2, 0x8ff1d2, 0.46);

    if (this.motionEnabled) {
      this.tweens.add({ targets: this.ship, x: 735, duration: 6600, repeat: -1, yoyo: true, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: this.factorySmoke, y: 286, alpha: 0.18, duration: 1900, repeat: -1, yoyo: true, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: this.powerGlow, scale: 1.28, alpha: 0.04, duration: 1250, repeat: -1, yoyo: true, ease: 'Sine.easeInOut' });
    }
  }

  private buildRoadTraffic() {
    this.roadVehicles = ROAD_TRAFFIC_PLAN.map((definition, index) => {
      const route = planRoadRoute(definition.origin, definition.destination);
      // Traffic must never use a multi-edge semantic route: several authored
      // corridors share a logical district name but do not meet at one painted
      // pixel junction. Keeping every trip on one traced edge guarantees that
      // vehicles cannot cut across terrain between those endpoints.
      if (route.traversals.length !== 1) {
        throw new Error(`Traffic route ${definition.origin} → ${definition.destination} is not a single painted corridor`);
      }
      const container = this.createVehicleGraphic(definition.kind, definition.color)
        .setData('entityId', `road-vehicle-${String(index + 1).padStart(2, '0')}`)
        .setData('origin', definition.origin)
        .setData('destination', definition.destination)
        .setDepth(20);
      const vehicle: RoadVehicle = {
        container,
        kind: definition.kind,
        origin: definition.origin,
        destination: definition.destination,
        route,
        distance: route.length * definition.phase,
        baseSpeed: definition.speed,
        actualSpeed: definition.speed,
        laneOffset: definition.lane,
        visibilityThreshold: definition.threshold,
        activityAlpha: 1,
        sample: sampleRoadRoute(route, route.length * definition.phase, definition.lane),
      };
      this.positionRoadVehicle(vehicle);
      return vehicle;
    });
  }

  private createVehicleGraphic(kind: TrafficVehicleKind, color: number) {
    const container = this.add.container(0, 0);
    const graphic = this.add.graphics();
    graphic.fillStyle(0x061018, 0.34).fillEllipse(1, 1, kind === 'truck' || kind === 'bus' ? 23 : 17, 10);

    if (kind === 'truck') {
      graphic.fillStyle(color, 1).fillRoundedRect(-12, -4, 15, 8, 2);
      graphic.fillStyle(0xf2f5e9, 1).fillRoundedRect(2, -4, 9, 8, 2);
      graphic.fillStyle(0x244854, 1).fillRect(6, -3, 4, 6);
      graphic.fillStyle(0x07131d, 1).fillRect(-8, -5, 4, 2).fillRect(-8, 3, 4, 2).fillRect(5, -5, 4, 2).fillRect(5, 3, 4, 2);
    } else if (kind === 'bus') {
      graphic.fillStyle(color, 1).fillRoundedRect(-11, -4, 22, 8, 3);
      graphic.fillStyle(0x244857, 1).fillRoundedRect(-7, -3, 14, 6, 2);
      graphic.fillStyle(color, 1).fillRect(-2, -3, 2, 6).fillRect(3, -3, 2, 6);
      graphic.fillStyle(0x07131d, 1).fillRect(-8, -5, 4, 2).fillRect(-8, 3, 4, 2).fillRect(6, -5, 4, 2).fillRect(6, 3, 4, 2);
    } else if (kind === 'van') {
      graphic.fillStyle(color, 1).fillRoundedRect(-8, -4, 17, 8, 3);
      graphic.fillStyle(0x214451, 1).fillRoundedRect(2, -3, 5, 6, 2);
      graphic.fillStyle(0x07131d, 1).fillRect(-5, -5, 3, 2).fillRect(-5, 3, 3, 2).fillRect(4, -5, 3, 2).fillRect(4, 3, 3, 2);
    } else {
      graphic.fillStyle(color, 1).fillRoundedRect(-7, -3, 14, 6, 3);
      graphic.fillStyle(0xdaf3f3, 0.88).fillRoundedRect(-1, -2, 6, 4, 2);
      graphic.fillStyle(0x07131d, 1).fillRect(-5, -4, 3, 1.7).fillRect(-5, 2.3, 3, 1.7).fillRect(3, -4, 3, 1.7).fillRect(3, 2.3, 3, 1.7);
    }
    graphic.fillStyle(0xfff3bd, 0.95).fillCircle(kind === 'truck' || kind === 'bus' ? 10 : 7, -2, 0.9).fillCircle(kind === 'truck' || kind === 'bus' ? 10 : 7, 2, 0.9);
    graphic.fillStyle(0xef5350, 0.9).fillCircle(kind === 'truck' ? -11 : kind === 'bus' ? -10 : -7, -2, 0.75).fillCircle(kind === 'truck' ? -11 : kind === 'bus' ? -10 : -7, 2, 0.75);
    container.add(graphic);
    return container;
  }

  private positionRoadVehicle(vehicle: RoadVehicle) {
    const routeDistance = Phaser.Math.Clamp(vehicle.distance, 0, vehicle.route.length);
    const sample = sampleRoadRoute(vehicle.route, routeDistance, vehicle.laneOffset);
    vehicle.sample = sample;
    const fadeDistance = Math.min(24, vehicle.route.length * 0.08);
    const edgeDistance = Math.min(routeDistance, vehicle.route.length - routeDistance);
    const edgeFade = Phaser.Math.Clamp(edgeDistance / fadeDistance, 0, 1);
    const junctionFade = Phaser.Math.Clamp(sample.distanceToJunction / 14, 0, 1);
    vehicle.container
      .setPosition(sample.x, sample.y)
      .setRotation(sample.rotation)
      .setAlpha(vehicle.activityAlpha * edgeFade * junctionFade)
      .setData('roadEdgeId', sample.edgeId)
      .setData('origin', vehicle.origin)
      .setData('destination', vehicle.destination);
  }

  private beginNextVehicleTrip(vehicle: RoadVehicle) {
    // Reverse on the same painted corridor. At distance 0 the endpoint fade is
    // fully transparent, so the 180° turn happens invisibly with no teleport.
    const previousOrigin = vehicle.origin;
    vehicle.origin = vehicle.destination;
    vehicle.destination = previousOrigin;
    vehicle.route = planRoadRoute(vehicle.origin, vehicle.destination);
    vehicle.distance = 0;
    vehicle.actualSpeed = Math.min(vehicle.actualSpeed, vehicle.baseSpeed * 0.55);
    this.positionRoadVehicle(vehicle);
  }

  update(_time: number, delta: number) {
    if (!this.worldReady || !this.motionEnabled) return;
    const activitySpeed = 0.42 + this.trafficActivity * 0.88;

    // Fixed-corridor traffic cannot merge into unrelated routes. This queue
    // guard still prevents any same-direction vehicles from overlapping if the
    // traffic plan is expanded later; opposing traffic remains in its own lane.
    const laneGroups = new Map<string, RoadVehicle[]>();
    this.roadVehicles.forEach((vehicle) => {
      this.positionRoadVehicle(vehicle);
      const key = `${vehicle.sample.edgeId}:${vehicle.sample.edgeDirection}`;
      const group = laneGroups.get(key) ?? [];
      group.push(vehicle);
      laneGroups.set(key, group);
    });

    const desiredSpeeds = new Map<RoadVehicle, number>();
    laneGroups.forEach((vehicles) => {
      vehicles.sort((a, b) => a.sample.edgeProgress - b.sample.edgeProgress);
      vehicles.forEach((vehicle, index) => {
        let desired = vehicle.baseSpeed * activitySpeed;
        const ahead = vehicles[index + 1];
        if (ahead) {
          const safeGap = vehicle.kind === 'truck' || vehicle.kind === 'bus' ? 30 : 24;
          const gap = ahead.sample.edgeProgress - vehicle.sample.edgeProgress;
          const followFactor = Phaser.Math.Clamp((gap - 9) / (safeGap - 9), 0, 1);
          desired *= followFactor;
        }
        desiredSpeeds.set(vehicle, desired);
      });
    });

    this.roadVehicles.forEach((vehicle) => {
      const desired = desiredSpeeds.get(vehicle) ?? vehicle.baseSpeed * activitySpeed;
      vehicle.actualSpeed = Phaser.Math.Linear(vehicle.actualSpeed, desired, Math.min(1, delta / 220));
      vehicle.distance += delta * vehicle.actualSpeed;
      if (vehicle.distance >= vehicle.route.length) this.beginNextVehicleTrip(vehicle);
      this.positionRoadVehicle(vehicle);
    });
  }

  private buildMapChrome() {
    const top = this.add.graphics();
    top.fillStyle(0x061520, 0.88).fillRoundedRect(18, 16, 222, 49, 12);
    top.lineStyle(1, 0x8be6e5, 0.36).strokeRoundedRect(18, 16, 222, 49, 12);
    this.add.text(34, 27, 'LUMENIA · LIVE TERRAIN', { color: '#f4fbf4', fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold' });
    this.add.text(34, 44, 'Economic activity and regional impact', { color: '#8db2b6', fontFamily: 'Arial, sans-serif', fontSize: '10px' });

    const legend = this.add.graphics();
    legend.fillStyle(0x061520, 0.82).fillRoundedRect(738, 17, 204, 44, 11);
    legend.lineStyle(1, 0xd5edf0, 0.24).strokeRoundedRect(738, 17, 204, 44, 11);
    this.add.circle(757, 39, 4, 0x7be2bc, 1);
    this.add.text(768, 34, 'STABLE', { color: '#bfe6d8', fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold' });
    this.add.circle(835, 39, 4, 0xffba6b, 1);
    this.add.text(846, 34, 'DISRUPTED', { color: '#f4d19c', fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold' });
  }

  private drawEventEffect(graphics: Phaser.GameObjects.Graphics, layout: RegionLayout, region: RegionVisualState) {
    const mainEvent = region.events[0];
    if (!mainEvent) return;
    const { x, y, w, h } = layout.bounds;
    const color = EVENT_PRESENTATION[mainEvent.type].color;
    const alpha = Math.min(0.34, 0.06 + mainEvent.intensity * 0.26);
    graphics.fillStyle(color, alpha).fillPoints(toPoints(layout.points), true);

    if (mainEvent.type === 'flood') {
      graphics.lineStyle(2, 0x9eeeff, 0.68);
      for (let row = 0; row < 5; row += 1) {
        const waveY = y + h * (0.42 + row * 0.085);
        graphics.beginPath().moveTo(x + w * 0.18, waveY).lineTo(x + w * 0.36, waveY - 5).lineTo(x + w * 0.54, waveY).lineTo(x + w * 0.72, waveY - 5).strokePath();
      }
    } else if (mainEvent.type === 'drought') {
      graphics.lineStyle(2, 0xffd27a, 0.56);
      for (let i = 0; i < 6; i += 1) {
        const crackX = x + 70 + i * 52;
        const crackY = y + 92 + (i % 2) * 30;
        graphics.beginPath().moveTo(crackX, crackY).lineTo(crackX + 10, crackY + 13).lineTo(crackX + 2, crackY + 25).strokePath();
      }
    } else if (mainEvent.type === 'war') {
      graphics.lineStyle(5, 0xff7770, 0.34);
      for (let i = -2; i < 8; i += 1) graphics.beginPath().moveTo(x + i * 62, y + h).lineTo(x + 100 + i * 62, y).strokePath();
    } else if (mainEvent.type === 'oil_shock' || mainEvent.type === 'banking_crisis') {
      graphics.lineStyle(3, color, 0.65).strokeCircle(layout.anchor[0], layout.anchor[1] + 18, 34 + mainEvent.intensity * 18);
      graphics.lineStyle(1, 0xffffff, 0.45).strokeCircle(layout.anchor[0], layout.anchor[1] + 18, 45 + mainEvent.intensity * 20);
    } else if (mainEvent.type === 'productivity_boom') {
      graphics.fillStyle(0xc8ffe0, 0.74);
      for (let i = 0; i < 9; i += 1) graphics.fillCircle(x + 44 + ((i * 71) % Math.max(90, w - 70)), y + 48 + ((i * 43) % Math.max(70, h - 80)), 2 + (i % 2));
    }
  }

  private syncWorldState() {
    if (!this.worldReady) return;
    const { country, selectedRegion, highlightedRegion } = useGameStore.getState();
    const visual = selectWorldVisualState(country);
    this.selectionPulse?.clear();

    regionOrder.forEach((id) => {
      const layout = regionLayout[id];
      const view = this.regionViews.get(id);
      const region = visual.regions[id];
      if (!view || !region) return;
      const isSelected = selectedRegion === id;
      const isHighlighted = highlightedRegion === id;
      const activeEvent = region.events.find((event) => event.active);
      const statusLabel = activeEvent
        ? EVENT_PRESENTATION[activeEvent.type].label.toUpperCase()
        : region.status === 'expanding' ? 'EXPANDING' : region.status === 'recovering' ? 'RECOVERING' : 'STABLE';
      const statusColor = activeEvent ? 0xffbd75 : region.status === 'expanding' ? 0x77e6b2 : region.status === 'recovering' ? 0x8edbc8 : 0xa8dfc3;

      view.outline.clear();
      if (isSelected || isHighlighted) {
        view.outline.fillStyle(layout.accent, isSelected ? 0.16 : 0.09).fillPoints(toPoints(layout.points), true);
        view.outline.lineStyle(isSelected ? 4 : 2, isSelected ? 0xffdc79 : layout.accent, isSelected ? 0.96 : 0.72).strokePoints(toPoints(layout.points), true);
      } else {
        view.outline.lineStyle(1, layout.accent, 0.2).strokePoints(toPoints(layout.points), true);
      }

      if (isSelected) this.selectionPulse?.lineStyle(8, 0xffda72, 0.18).strokePoints(toPoints(layout.points), true);

      view.effect.clear();
      this.drawEventEffect(view.effect, layout, region);
      view.badge.clear();
      view.badge.fillStyle(0x061520, 0.88).fillRoundedRect(layout.anchor[0] - 67, layout.anchor[1] - 19, 134, 43, 10);
      view.badge.lineStyle(1, isSelected ? 0xffdd7a : layout.accent, isSelected ? 0.9 : 0.52).strokeRoundedRect(layout.anchor[0] - 67, layout.anchor[1] - 19, 134, 43, 10);
      view.badge.fillStyle(statusColor, 1).fillCircle(layout.anchor[0] - 52, layout.anchor[1] + 11, 3);
      view.label.setColor(isSelected ? '#ffe7a0' : '#f7fbf4');
      view.status.setText(`${statusLabel}  ·  ${region.health.toFixed(0)}%`).setColor(activeEvent ? '#ffd29a' : '#bfe5d8');
    });

    this.trafficActivity = visual.activity.roadFreight;
    this.roadVehicles.forEach((vehicle, index) => {
      const activityVisibility = Phaser.Math.Clamp((this.trafficActivity - vehicle.visibilityThreshold) * 2.6, 0, 1);
      vehicle.activityAlpha = (index < 4 ? 0.42 : 0.12) + activityVisibility * (index < 4 ? 0.58 : 0.88);
      vehicle.container.setScale(0.84 + this.trafficActivity * 0.18);
      this.positionRoadVehicle(vehicle);
    });
    this.ship?.setAlpha(0.2 + visual.activity.shipping * 0.8).setScale(0.9 + visual.activity.shipping * 0.18);
    this.factorySmoke?.setAlpha(0.08 + visual.activity.factory * 0.56);
    this.powerGlow?.setAlpha(0.03 + visual.activity.power * 0.16);
  }
}
