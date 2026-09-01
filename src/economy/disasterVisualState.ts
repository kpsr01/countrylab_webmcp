import type { CountryState, EventType, RegionId, SectorId } from './types';
import { EVENT_PRESENTATION, selectWorldVisualState } from './visualState';

export type DisasterPhase = 'impact' | 'ongoing' | 'adapting' | 'recovering' | 'stable';

export interface DisasterRegionPresentation {
  id: RegionId;
  activity: number;
  disruption: number;
  recoveryProgress: number;
  resourceLevel: number;
  phase: DisasterPhase;
  mainEvent?: {
    id: string;
    type: EventType;
    intensity: number;
    active: boolean;
  };
}

export interface DisasterWorldPresentation {
  regions: Record<RegionId, DisasterRegionPresentation>;
  activity: {
    roadFreight: number;
    shipping: number;
    factory: number;
    power: number;
    agriculture: number;
    finance: number;
  };
  scarcity: {
    food: number;
    energy: number;
    trade: number;
    credit: number;
  };
}

const regionIds: RegionId[] = ['capital', 'farmbelt', 'industrial', 'port', 'energy'];
const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const normalizedIndex = (value: number, low = 25, high = 125) => clamp01((value - low) / (high - low));

function sectorActivity(country: CountryState, sector: SectorId) {
  const state = country.sectors[sector];
  return clamp01((normalizedIndex(state.output, 20, 125) * 0.58) + (normalizedIndex(state.capacity, 20, 125) * 0.42));
}

function eventPhase(country: CountryState, eventId: string, active: boolean, recoveryProgress: number): DisasterPhase {
  const event = country.eventHistory.find((candidate) => candidate.id === eventId);
  if (!event) return recoveryProgress > 0 ? 'recovering' : 'stable';
  if (!active) return recoveryProgress > 0 ? 'recovering' : 'stable';
  const elapsed = Math.max(0, event.durationMonths - event.monthsRemaining);
  const progress = clamp01(elapsed / Math.max(1, event.durationMonths));
  if (progress < 0.2) return 'impact';
  if (progress < 0.62) return 'ongoing';
  return 'adapting';
}

export function selectDisasterWorldPresentation(country: CountryState): DisasterWorldPresentation {
  const world = selectWorldVisualState(country);
  const agricultureSector = sectorActivity(country, 'agriculture');
  const factorySector = sectorActivity(country, 'manufacturing');
  const energySector = sectorActivity(country, 'energy');
  const tradeSector = sectorActivity(country, 'trade');
  const bankingSector = sectorActivity(country, 'banking');

  const agriculture = clamp01(agricultureSector * 0.7 + normalizedIndex(country.metrics.foodIndex, 30, 125) * 0.3);
  const factory = clamp01(factorySector * 0.72 + normalizedIndex(country.metrics.industrialOutput, 25, 130) * 0.28);
  const power = clamp01(energySector * 0.72 + normalizedIndex(country.metrics.energyIndex, 30, 125) * 0.28);
  const shipping = clamp01(tradeSector * 0.56 + normalizedIndex(Math.min(country.metrics.importsIndex, country.metrics.exportsIndex), 25, 130) * 0.44);
  const finance = clamp01(bankingSector * 0.72 + normalizedIndex(country.metrics.confidence, 5, 95) * 0.28);
  const roadFreight = clamp01(world.activity.roadFreight * 0.38 + Math.min(factory, shipping) * 0.42 + normalizedIndex(country.metrics.gdp, 35, 220) * 0.2);

  const activityByRegion: Record<RegionId, number> = {
    capital: finance,
    farmbelt: agriculture,
    industrial: factory,
    port: shipping,
    energy: power,
  };
  const resourceByRegion: Record<RegionId, number> = {
    capital: finance,
    farmbelt: normalizedIndex(country.metrics.foodIndex, 30, 125),
    industrial: normalizedIndex(country.metrics.industrialOutput, 25, 130),
    port: normalizedIndex(Math.min(country.metrics.importsIndex, country.metrics.exportsIndex), 25, 130),
    energy: normalizedIndex(country.metrics.energyIndex, 30, 125),
  };

  const regions = Object.fromEntries(regionIds.map((id) => {
    const base = world.regions[id];
    const activity = activityByRegion[id];
    const resourceLevel = resourceByRegion[id];
    const primary = base.events[0];
    const negativeEvent = primary && EVENT_PRESENTATION[primary.type].tone === 'negative';
    const disruption = clamp01(Math.max(base.damage, 1 - activity, 1 - resourceLevel, negativeEvent && primary.active ? primary.intensity * 0.68 : 0));
    const recoveryProgress = clamp01(base.recovery * (1 - disruption * 0.45));
    const intensity = primary
      ? clamp01(negativeEvent
        ? Math.max(primary.intensity * 0.58, disruption * 0.86)
        : Math.max(primary.intensity * 0.5, Math.max(0, activity - 0.72) * 1.35))
      : 0;

    return [id, {
      id,
      activity,
      disruption,
      recoveryProgress,
      resourceLevel,
      phase: primary ? eventPhase(country, primary.id, primary.active, recoveryProgress) : recoveryProgress > 0 ? 'recovering' : 'stable',
      mainEvent: primary ? { id: primary.id, type: primary.type, intensity, active: primary.active } : undefined,
    } satisfies DisasterRegionPresentation];
  })) as Record<RegionId, DisasterRegionPresentation>;

  return {
    regions,
    activity: { roadFreight, shipping, factory, power, agriculture, finance },
    scarcity: {
      food: clamp01(1 - normalizedIndex(country.metrics.foodIndex, 30, 125)),
      energy: clamp01(1 - normalizedIndex(country.metrics.energyIndex, 30, 125)),
      trade: clamp01(1 - shipping),
      credit: clamp01(1 - finance),
    },
  };
}
