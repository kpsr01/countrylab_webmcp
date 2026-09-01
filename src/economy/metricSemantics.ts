import type { MetricKey } from './types';

/**
 * Whether a higher value represents a better economic outcome for each metric.
 * This is the single source of truth for red/green change semantics in the UI.
 */
export const METRIC_HIGHER_IS_BETTER: Record<MetricKey, boolean> = {
  gdp: true,
  inflation: false,
  unemployment: false,
  debtPct: false,
  foodIndex: true,
  energyIndex: true,
  industrialOutput: true,
  importsIndex: true,
  exportsIndex: true,
  confidence: true,
};

/**
 * Returns true when a metric delta moves in the economically desirable direction.
 * Flat values retain the existing non-negative treatment used by the dashboard.
 */
export function isMetricChangeGood(metric: MetricKey, delta: number): boolean {
  if (!Number.isFinite(delta)) return false;
  if (Math.abs(delta) < 0.005) return true;
  return (delta > 0) === METRIC_HIGHER_IS_BETTER[metric];
}
