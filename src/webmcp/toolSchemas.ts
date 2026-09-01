import type { MetricKey, RegionId, SectorId } from '../economy/types';

export const REGIONS: RegionId[] = ['capital', 'farmbelt', 'industrial', 'port', 'energy'];
export const EVENTS = ['flood', 'drought', 'oil_shock', 'trade_conflict', 'banking_crisis', 'productivity_boom'] as const;
export const SECTORS: SectorId[] = ['agriculture', 'manufacturing', 'energy', 'trade', 'banking', 'households', 'government', 'central_bank'];
export const METRICS: MetricKey[] = ['gdp', 'inflation', 'unemployment', 'debtPct', 'foodIndex', 'energyIndex', 'industrialOutput', 'importsIndex', 'exportsIndex', 'confidence'];
export const POLICIES = ['interest_rate', 'income_tax', 'corporate_tax', 'government_spending', 'tariff', 'emergency_spending'] as const;

const objectSchema = (properties: Record<string, object>, required: string[] = []) => ({ type: 'object', properties, required, additionalProperties: false });
const stringEnum = (values: readonly string[]) => ({ type: 'string', enum: values });
const integer = (minimum: number, maximum: number) => ({ type: 'integer', minimum, maximum });
const number = (minimum: number, maximum: number) => ({ type: 'number', minimum, maximum });
const constant = (value: string) => ({ type: 'string', const: value });

const policyVariant = (policy: typeof POLICIES[number], minimum: number, maximum: number, extra: Record<string, object> = {}) => objectSchema({
  policy: constant(policy),
  value: number(minimum, maximum),
  ...extra,
}, ['policy', 'value']);

export const emptySchema = objectSchema({});
export const inspectRegionSchema = objectSchema({ region: stringEnum(REGIONS) }, ['region']);
export const inspectSectorSchema = objectSchema({ sector: stringEnum(SECTORS) }, ['sector']);
export const metricHistorySchema = objectSchema({ metric: stringEnum(METRICS), months: integer(1, 60) }, ['metric']);
export const causalHistorySchema = objectSchema({ metric: stringEnum(METRICS), months: integer(1, 36) }, ['metric']);

export const changePolicySchema = {
  type: 'object',
  properties: { policy: stringEnum(POLICIES), value: { type: 'number' } },
  required: ['policy', 'value'],
  additionalProperties: false,
  oneOf: [
    policyVariant('interest_rate', 0, 20),
    policyVariant('income_tax', 0, 60),
    policyVariant('corporate_tax', 0, 60),
    policyVariant('government_spending', 0, 100),
    policyVariant('tariff', 0, 50),
    policyVariant('emergency_spending', 0, 100),
  ],
};

const eventVariant = (event: typeof EVENTS[number], region: RegionId) => objectSchema({
  event: constant(event),
  region: { type: 'string', const: region },
  severity: number(0.25, 2),
}, ['event']);

export const triggerEventSchema = {
  type: 'object',
  properties: { event: stringEnum(EVENTS), region: stringEnum(REGIONS), severity: number(0.25, 2) },
  required: ['event'],
  additionalProperties: false,
  oneOf: [
    eventVariant('flood', 'port'),
    eventVariant('drought', 'farmbelt'),
    eventVariant('oil_shock', 'energy'),
    eventVariant('trade_conflict', 'industrial'),
    eventVariant('banking_crisis', 'capital'),
    eventVariant('productivity_boom', 'industrial'),
  ],
};

export const emergencySchema = objectSchema({ spending: number(0, 100) }, ['spending']);
export const advanceSchema = objectSchema({ months: integer(1, 24) }, ['months']);
export const snapshotSchema = objectSchema({ label: { type: 'string', minLength: 1, maxLength: 80 } }, []);

const snapshotId = { type: 'string', minLength: 1, maxLength: 128 };
const eventId = { type: 'string', minLength: 1, maxLength: 128, description: "Use the normalized eventId returned by get_event_history/get_causal_history (for example 'event-1', not 'event:event-1')." };
const cfCommon = { months: integer(1, 36), snapshotId };
const counterfactualPolicyVariant = (policy: typeof POLICIES[number], minimum: number, maximum: number) => objectSchema({
  type: constant('change_policy'),
  policy: constant(policy),
  value: number(minimum, maximum),
  ...cfCommon,
}, ['type', 'policy', 'value', 'months']);

export const counterfactualSchema = {
  type: 'object',
  properties: {
    type: stringEnum(['remove_event', 'change_policy', 'change_event_severity']),
    eventId,
    policy: stringEnum(POLICIES),
    value: { type: 'number' },
    severity: number(0.25, 2),
    months: integer(1, 36),
    snapshotId,
  },
  required: ['type', 'months'],
  additionalProperties: false,
  oneOf: [
    objectSchema({ type: constant('remove_event'), eventId, ...cfCommon }, ['type', 'eventId', 'months']),
    objectSchema({ type: constant('change_event_severity'), eventId, severity: number(0.25, 2), ...cfCommon }, ['type', 'eventId', 'severity', 'months']),
    counterfactualPolicyVariant('interest_rate', 0, 20),
    counterfactualPolicyVariant('income_tax', 0, 60),
    counterfactualPolicyVariant('corporate_tax', 0, 60),
    counterfactualPolicyVariant('government_spending', 0, 100),
    counterfactualPolicyVariant('tariff', 0, 50),
    counterfactualPolicyVariant('emergency_spending', 0, 100),
  ],
};

export const compareSchema = objectSchema({ baselineScenarioId: { type: 'string', minLength: 1, maxLength: 128 }, counterfactualScenarioId: { type: 'string', minLength: 1, maxLength: 128 } }, ['baselineScenarioId', 'counterfactualScenarioId']);
export const highlightSchema = inspectRegionSchema;
export const metricSchema = objectSchema({ metric: stringEnum(METRICS) }, ['metric']);
export const comparisonSchema = objectSchema({ comparisonId: { type: 'string', minLength: 1, maxLength: 128 } }, ['comparisonId']);
