import type { RegionId } from '../economy/types';

export type WorldEntityId =
  | 'central-city'
  | 'residential-quarter'
  | 'greenbelt-farms'
  | 'ironworks-industrial'
  | 'south-port'
  | 'energy-power-plant'
  | 'government-house'
  | 'national-bank'
  | 'civic-hospital'
  | 'island-road-network'
  | 'country-coastline'
  | 'resource-mountains'
  | 'western-forest';

export type WorldEntityKind = 'district' | 'building' | 'infrastructure' | 'terrain';

export interface WorldEntityDefinition {
  id: WorldEntityId;
  regionId: RegionId;
  kind: WorldEntityKind;
  label: string;
  description: string;
  x: number;
  y: number;
}

export const WORLD_ENTITIES: readonly WorldEntityDefinition[] = [
  { id: 'central-city', regionId: 'capital', kind: 'district', label: 'Central City', description: 'Services, commerce and national demand.', x: 480, y: 333 },
  { id: 'residential-quarter', regionId: 'capital', kind: 'district', label: 'Residential Quarter', description: 'Homes and neighborhood services.', x: 423, y: 390 },
  { id: 'greenbelt-farms', regionId: 'farmbelt', kind: 'district', label: 'Greenbelt Farms', description: 'The country’s main food-producing district.', x: 681, y: 179 },
  { id: 'ironworks-industrial', regionId: 'industrial', kind: 'district', label: 'Ironworks', description: 'Factories, jobs and export production.', x: 758, y: 398 },
  { id: 'south-port', regionId: 'port', kind: 'infrastructure', label: 'South Port', description: 'Imports, exports and maritime trade.', x: 548, y: 573 },
  { id: 'energy-power-plant', regionId: 'energy', kind: 'building', label: 'Basin Power', description: 'Electricity generation and fuel supply.', x: 190, y: 364 },
  { id: 'government-house', regionId: 'capital', kind: 'building', label: 'Government House', description: 'Public administration and fiscal policy.', x: 443, y: 325 },
  { id: 'national-bank', regionId: 'capital', kind: 'building', label: 'National Bank', description: 'Interest-rate policy and financial stability.', x: 492, y: 356 },
  { id: 'civic-hospital', regionId: 'capital', kind: 'building', label: 'Civic Hospital', description: 'Essential public health services.', x: 540, y: 327 },
  { id: 'island-road-network', regionId: 'capital', kind: 'infrastructure', label: 'National Roads', description: 'Connects production, homes and trade.', x: 484, y: 405 },
  { id: 'country-coastline', regionId: 'port', kind: 'terrain', label: 'Coastline', description: 'The island’s maritime boundary and harbor.', x: 767, y: 579 },
  { id: 'resource-mountains', regionId: 'farmbelt', kind: 'terrain', label: 'Resource Highlands', description: 'Mountain resources and headwaters.', x: 220, y: 92 },
  { id: 'western-forest', regionId: 'farmbelt', kind: 'terrain', label: 'Western Forest', description: 'Timber, habitat and watershed protection.', x: 106, y: 208 },
] as const;

export const REGION_PRESENTATION: Record<RegionId, { label: string; role: string; description: string }> = {
  capital: {
    label: 'Capital District',
    role: 'Services & government',
    description: 'The civic and commercial center, with homes, finance, health care and national administration.',
  },
  farmbelt: {
    label: 'Greenbelt Farms',
    role: 'Food & land',
    description: 'Farms and forests supply food and natural resources to the rest of the island.',
  },
  industrial: {
    label: 'Ironworks',
    role: 'Industry & jobs',
    description: 'Factories turn energy and imported inputs into domestic goods and exports.',
  },
  port: {
    label: 'South Port',
    role: 'Trade & logistics',
    description: 'The harbor connects the island to imports, export markets and overseas supply chains.',
  },
  energy: {
    label: 'Energy Basin',
    role: 'Power & resources',
    description: 'Power generation and fuel supply keep homes and industry operating.',
  },
};

export function getRegionEntities(regionId: RegionId) {
  return WORLD_ENTITIES.filter((entity) => entity.regionId === regionId);
}
