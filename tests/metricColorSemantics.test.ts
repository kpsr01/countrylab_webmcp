import assert from 'node:assert/strict';
import test from 'node:test';
import { isMetricChangeGood, METRIC_HIGHER_IS_BETTER } from '../src/economy/metricSemantics.ts';

test('lower-is-better metrics use green for decreases and red for increases', () => {
  for (const metric of ['inflation', 'unemployment', 'debtPct'] as const) {
    assert.equal(METRIC_HIGHER_IS_BETTER[metric], false);
    assert.equal(isMetricChangeGood(metric, -1), true, `${metric} decrease should be good`);
    assert.equal(isMetricChangeGood(metric, 1), false, `${metric} increase should be bad`);
  }
});

test('higher-is-better metrics use green for increases and red for decreases', () => {
  for (const metric of ['gdp', 'foodIndex', 'energyIndex', 'industrialOutput', 'importsIndex', 'exportsIndex', 'confidence'] as const) {
    assert.equal(METRIC_HIGHER_IS_BETTER[metric], true);
    assert.equal(isMetricChangeGood(metric, 1), true, `${metric} increase should be good`);
    assert.equal(isMetricChangeGood(metric, -1), false, `${metric} decrease should be bad`);
  }
});

test('flat changes preserve the dashboard neutral/non-negative treatment', () => {
  assert.equal(isMetricChangeGood('unemployment', 0), true);
  assert.equal(isMetricChangeGood('gdp', 0), true);
});
