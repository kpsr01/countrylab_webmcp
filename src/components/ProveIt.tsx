import { useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { EVENT_PRESENTATION, METRIC_PRESENTATION } from '../economy/visualState';
import type { MetricKey, PolicyKey, RegionId, ScenarioIntervention, ScenarioComparisonResult } from '../economy/types';

const policyOptions: Array<{ key: PolicyKey; label: string; min: number; max: number; step: number; suffix: string }> = [
  { key: 'interestRate', label: 'Interest rate', min: 0, max: 20, step: 0.5, suffix: '%' },
  { key: 'corporateTax', label: 'Corporate tax', min: 0, max: 60, step: 1, suffix: '%' },
  { key: 'governmentSpending', label: 'Government spending', min: 0, max: 100, step: 1, suffix: '' },
  { key: 'tariffRate', label: 'Tariff', min: 0, max: 50, step: 1, suffix: '%' },
  { key: 'emergencySpending', label: 'Emergency relief', min: 0, max: 100, step: 1, suffix: '' },
];
const regions: RegionId[] = ['capital', 'farmbelt', 'industrial', 'port', 'energy'];
const readablePolicy = (key: PolicyKey) => policyOptions.find((policy) => policy.key === key)?.label ?? key;
const readableNode = (node: string, result: ScenarioComparisonResult) => {
  if (node.startsWith('event:')) {
    const event = result.baseline.finalState.eventHistory.find((candidate) => `event:${candidate.id}` === node) ?? result.counterfactual.finalState.eventHistory.find((candidate) => `event:${candidate.id}` === node);
    return EVENT_PRESENTATION[event?.type ?? 'flood'].label;
  }
  if (node.startsWith('policy:')) return readablePolicy(node.slice(7) as PolicyKey);
  if (node.startsWith('sector:')) return node.slice(7).replace('_', ' ');
  if (node.startsWith('metric:')) return METRIC_PRESENTATION.find((metric) => metric.key === node.slice(7))?.label ?? node.slice(7);
  return node.replaceAll('-', ' ');
};
const chainText = (chain: string[], result: ScenarioComparisonResult) => chain.map((node) => readableNode(node, result)).join(' → ');

function ComparisonResult({ result }: { result: ScenarioComparisonResult }) {
  const metricKeys: MetricKey[] = ['gdp', 'inflation', 'unemployment', 'debtPct', 'foodIndex', 'energyIndex'];
  const baseMonth = result.baseline.startState.month;
  const rows = Array.from({ length: result.monthsSimulated + 1 }, (_, index) => baseMonth + index);
  const baselineHistory = new Map(result.baseline.history.map((point) => [point.month, point]));
  const counterHistory = new Map(result.counterfactual.history.map((point) => [point.month, point]));
  return (
    <section className="comparison-result" aria-label="Counterfactual comparison">
      <div className="comparison-result-heading"><div><p className="eyebrow">Experiment result</p><h3>{result.counterfactual.label}</h3></div><span className={result.timelinesDiverged ? 'result-supported' : 'result-neutral'}>{result.timelinesDiverged ? 'Measurable divergence' : 'No measurable change'}</span></div>
      <p className="comparison-summary">{result.summary}</p>
      <div className="comparison-grid">
        {metricKeys.map((key) => {
          const metric = METRIC_PRESENTATION.find((item) => item.key === key);
          const difference = result.metricDifferences[key];
          return <div className="comparison-metric" key={key}><small>{metric?.label ?? key}</small><div><b>{difference.baseline.toFixed(1)}{metric?.suffix}</b><span>→</span><b>{difference.counterfactual.toFixed(1)}{metric?.suffix}</b></div><strong className={difference.difference >= 0 ? 'diff-positive' : 'diff-negative'}>{difference.difference >= 0 ? '+' : ''}{difference.difference.toFixed(1)}{metric?.suffix}</strong></div>;
        })}
      </div>
      <div className="comparison-section">
        <div className="comparison-section-heading"><h4>Timeline divergence</h4><span>{result.divergenceMonth ? `First difference · M${result.divergenceMonth}` : 'Timelines stayed aligned'}</span></div>
        <div className="comparison-table-wrap"><table className="comparison-table"><thead><tr><th>Month</th><th>{result.baseline.label} · inflation</th><th>{result.counterfactual.label} · inflation</th><th>GDP difference</th></tr></thead><tbody>{rows.map((month) => { const baseline = month === baseMonth ? result.baseline.startState : baselineHistory.get(month); const counter = month === baseMonth ? result.counterfactual.startState : counterHistory.get(month); if (!baseline || !counter) return null; const baseMetrics = 'metrics' in baseline ? baseline.metrics : baseline; const counterMetrics = 'metrics' in counter ? counter.metrics : counter; const difference = counterMetrics.gdp - baseMetrics.gdp; return <tr className={result.divergenceMonth === month ? 'is-divergence' : ''} key={month}><th>M{month}</th><td>{baseMetrics.inflation.toFixed(1)}%</td><td>{counterMetrics.inflation.toFixed(1)}%</td><td className={difference >= 0 ? 'diff-positive' : 'diff-negative'}>{difference >= 0 ? '+' : ''}{difference.toFixed(1)}</td></tr>; })}</tbody></table></div>
      </div>
      <div className="comparison-section">
        <div className="comparison-section-heading"><h4>Changed causal chains</h4><span>{result.causalDifferences.length} material changes</span></div>
        {result.causalDifferences.length ? <div className="causal-difference-list">{result.causalDifferences.slice(0, 6).map((difference) => <article key={`${difference.metric}-${difference.root}`}><strong>{METRIC_PRESENTATION.find((metric) => metric.key === difference.metric)?.label ?? difference.metric}</strong><p>{difference.descriptions[0]}</p><small>{chainText((difference.counterfactualChains[0] ?? difference.baselineChains[0] ?? []), result)}</small><b className={difference.difference >= 0 ? 'diff-positive' : 'diff-negative'}>{difference.difference >= 0 ? '+' : ''}{difference.difference.toFixed(2)}</b></article>)}</div> : <p className="muted">No causal chain changed over this horizon.</p>}
      </div>
    </section>
  );
}

export function ProveIt() {
  const country = useGameStore((state) => state.country);
  const snapshots = useGameStore((state) => state.snapshots);
  const branches = useGameStore((state) => state.branches);
  const activeComparisonId = useGameStore((state) => state.activeComparisonId);
  const comparisons = useGameStore((state) => state.comparisons);
  const baseSnapshotId = useGameStore((state) => state.baseSnapshotId);
  const [snapshotId, setSnapshotId] = useState(baseSnapshotId);
  const [kind, setKind] = useState<'event' | 'severity' | 'policy' | 'relief'>('event');
  const [eventId, setEventId] = useState(country.eventHistory.at(-1)?.id ?? '');
  const [severity, setSeverity] = useState(0.5);
  const [policyKey, setPolicyKey] = useState<PolicyKey>('interestRate');
  const [policyValue, setPolicyValue] = useState(country.policies.interestRate + 4);
  const [region, setRegion] = useState<RegionId>('port');
  const [runError, setRunError] = useState<string | null>(null);
  const selectedPolicy = policyOptions.find((policy) => policy.key === policyKey) ?? policyOptions[0];
  const [months, setMonths] = useState(12);
  useEffect(() => { setSnapshotId(baseSnapshotId); }, [baseSnapshotId]);
  const result = activeComparisonId ? comparisons[activeComparisonId] : null;
  const sourceCountry = snapshots[snapshotId]?.country ?? country;
  const events = sourceCountry.eventHistory;
  useEffect(() => { if (!events.some((event) => event.id === eventId) && events.at(-1)) setEventId(events.at(-1)!.id); }, [eventId, events]);

  function run() {
    setRunError(null);
    const event = events.find((candidate) => candidate.id === eventId);
    const intervention: ScenarioIntervention = kind === 'event'
      ? { kind: 'event', action: 'remove', eventId, eventType: event?.type, region: event?.region }
      : kind === 'severity'
        ? { kind: 'eventSeverity', eventId, severity }
        : kind === 'policy'
          ? { kind: 'policy', key: policyKey, value: policyValue }
          : { kind: 'relief', region, emergencySpending: 40, repairTo: 100 };
    const counterfactual = kind === 'event' ? `Without ${event ? EVENT_PRESENTATION[event.type].label : 'shock'}` : kind === 'severity' ? `${event ? EVENT_PRESENTATION[event.type].label : 'Shock'} · ${severity.toFixed(1)}× severity` : kind === 'policy' ? `${readablePolicy(policyKey)} · ${policyValue}` : 'Emergency Relief';
    try {
      useGameStore.getState().runExperiment(intervention, months, snapshotId, { baseline: snapshots[snapshotId]?.label ?? 'Current World', counterfactual });
    } catch (error) {
      setRunError(error instanceof Error ? error.message : 'The counterfactual could not be created.');
    }
  }

  return (
    <section className="prove-it" aria-label="Prove It experiment lab">
      <div className="prove-it-heading"><div><p className="eyebrow">Counterfactual lab</p><h2>Show me another country.</h2><p>Hold the current world steady, change one thing, and see whether the causal story survives.</p></div><span className="prove-it-mark">PROVE IT</span></div>
      <div className="experiment-builder">
        <div className="experiment-step"><span>01</span><label>Start from</label><select value={snapshotId} onChange={(event) => setSnapshotId(event.target.value)}>{Object.values(snapshots).map((snapshot) => <option key={snapshot.id} value={snapshot.id}>{snapshot.label} · M{snapshot.month}</option>)}</select><button onClick={() => setSnapshotId(useGameStore.getState().captureScenarioSnapshot('Current World').id)}>Capture current</button></div>
        <div className="experiment-step"><span>02</span><label>Change one thing</label><div className="experiment-tabs">{(['event', 'severity', 'policy', 'relief'] as const).map((value) => <button className={kind === value ? 'active' : ''} key={value} onClick={() => setKind(value)}>{value === 'event' ? 'Remove a shock' : value === 'severity' ? 'Change severity' : value === 'policy' ? 'Change policy' : 'Emergency relief'}</button>)}</div>{(kind === 'event' || kind === 'severity') && <select value={eventId} onChange={(event) => setEventId(event.target.value)} disabled={!events.length}>{events.length ? events.map((event) => <option key={event.id} value={event.id}>{EVENT_PRESENTATION[event.type].label} · {sourceCountry.regions[event.region].name}</option>) : <option>No recorded shocks</option>}</select>}{kind === 'severity' && <div className="experiment-inline"><label>Severity multiplier</label><input aria-label="Shock severity" type="number" min="0.25" max="2" step="0.25" value={severity} onChange={(event) => setSeverity(Number(event.target.value))} /></div>}{kind === 'policy' && <div className="experiment-inline"><select value={policyKey} onChange={(event) => setPolicyKey(event.target.value as PolicyKey)}>{policyOptions.map((policy) => <option key={policy.key} value={policy.key}>{policy.label}</option>)}</select><input aria-label="Policy value" type="number" value={policyValue} min={selectedPolicy.min} max={selectedPolicy.max} step={selectedPolicy.step} onChange={(event) => setPolicyValue(Number(event.target.value))} /></div>}{kind === 'relief' && <select value={region} onChange={(event) => setRegion(event.target.value as RegionId)}>{regions.map((id) => <option key={id} value={id}>{country.regions[id].name}</option>)}</select>}</div>
        <div className="experiment-step"><span>03</span><label>Run forward</label><div className="horizon-control"><input type="range" min="1" max="36" value={months} onChange={(event) => setMonths(Number(event.target.value))} /><b>{months} months</b></div><button className="prove-it-button" onClick={run} disabled={(kind === 'event' || kind === 'severity') && !events.length}>PROVE IT →</button></div>
      </div>
      <div className="branch-strip"><span>{Object.keys(branches).length} saved branch{Object.keys(branches).length === 1 ? '' : 'es'}</span><button onClick={() => useGameStore.getState().createBranch('Saved branch', snapshotId)}>Save branch</button>{Object.values(branches).slice(-3).map((branch) => <span className="branch-pill" key={branch.id}>{branch.label}<button aria-label={`Duplicate ${branch.label}`} onClick={() => useGameStore.getState().duplicateBranch(branch.id)}>+</button><button aria-label={`Delete ${branch.label}`} onClick={() => useGameStore.getState().deleteBranch(branch.id)}>×</button></span>)}</div>
      {runError && <div className="experiment-error" role="alert"><strong>Experiment not run.</strong><span>{runError}</span></div>}
      {result ? <ComparisonResult result={result} /> : <div className="prove-it-empty"><strong>Choose a shock or policy above.</strong><span>The baseline and alternate timeline will appear here with the first divergence highlighted.</span></div>}
    </section>
  );
}
