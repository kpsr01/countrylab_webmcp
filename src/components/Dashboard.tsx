import { useGameStore } from '../store/useGameStore';
import { isMetricChangeGood } from '../economy/metricSemantics';
import { METRIC_PRESENTATION, selectMetricCards, selectMetricExplanation } from '../economy/visualState';

function Sparkline({ values, good }: { values: number[]; good: boolean }) {
  if (values.length < 2) return <span className="sparkline sparkline-empty">—</span>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 100},${30 - ((value - min) / range) * 24}`).join(' ');
  return <svg className={`sparkline ${good ? 'is-good' : 'is-bad'}`} viewBox="0 0 100 30" role="img" aria-label="Recent trend"><polyline points={points} fill="none" vectorEffect="non-scaling-stroke" /></svg>;
}

const metricDefinitions: Record<string, string> = {
  inflation: 'How quickly average prices are rising.',
  gdp: 'The economy’s total output, tracked relative to its baseline.',
  debtPct: 'Government debt as a share of annual output.',
  foodIndex: 'A measure of how much food the economy can supply.',
  energyIndex: 'A measure of available energy and fuel supply.',
  importsIndex: 'The flow of goods and services bought from abroad.',
  exportsIndex: 'The flow of goods and services sold abroad.',
};

export function Dashboard() {
  const country = useGameStore((s) => s.country);
  const highlighted = useGameStore((s) => s.highlightedMetric);
  const cards = selectMetricCards(country);
  return (
    <section className="dashboard" aria-label="National indicators">
      <div className="dashboard-heading">
        <div><p className="eyebrow">National telemetry · month {country.month}</p><h2>Country pulse</h2></div>
        <span className="dashboard-instruction">Select a signal to inspect its causal chain <b>↗</b></span>
      </div>
      <div className="metrics-grid">
        {cards.map((card, index) => (
          <button className={`metric-card level-${card.level} ${highlighted === card.key ? 'is-highlighted' : ''}`} key={card.key} aria-pressed={highlighted === card.key} onClick={() => useGameStore.getState().highlightMetric(highlighted === card.key ? null : card.key)}>
            <span className="metric-top"><span className="metric-label">{card.label}</span><i>{String(index + 1).padStart(2, '0')}</i></span>
            <strong>{card.value.toFixed(1)}{card.suffix}</strong>
            <span className={`metric-delta ${card.trendIsGood ? 'is-good' : 'is-bad'}`}>{card.delta > 0 ? '↑' : card.delta < 0 ? '↓' : '→'} {Math.abs(card.delta).toFixed(1)} vs last month</span>
            <Sparkline values={card.series} good={card.trendIsGood} />
            <span className="metric-state"><i /> {card.level}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function WhyInspector() {
  const country = useGameStore((s) => s.country);
  const highlighted = useGameStore((s) => s.highlightedMetric);
  const explanation = highlighted ? selectMetricExplanation(country, highlighted) : null;
  if (!explanation) return null;
  const explanationIsGood = isMetricChangeGood(explanation.metric, explanation.delta);
  return (
    <section className="why-panel" aria-label={`Why ${explanation.label} changed`}>
      <div className="why-sidebar">
        <p className="eyebrow">WHY inspector · M{explanation.month}</p>
        <h2>{explanation.label}</h2>
        <strong className={explanationIsGood ? 'is-good' : 'is-bad'}>{explanation.delta >= 0 ? '+' : ''}{explanation.delta.toFixed(1)}</strong>
        <p className="metric-definition">{metricDefinitions[explanation.metric]}</p>
        <p>{explanation.summary}</p>
        <button className="close-inspector" onClick={() => useGameStore.getState().highlightMetric(null)}>Close inspector</button>
      </div>
      <div className="causal-area">
        <div className="causal-area-heading"><div><span>Causal evidence</span><strong>What moved the signal</strong></div><small>Deterministic simulation data</small></div>
        {explanation.contributors.length ? (
          <div className="causal-list">
            {explanation.contributors.map((contributor, index) => {
              const eventRoot = [...contributor.roots, ...contributor.chain].find((node) => node.startsWith('event:'));
              const event = eventRoot ? country.eventHistory.find((candidate) => candidate.id === eventRoot.slice(6)) : null;
              return <div className="causal-row" key={`${contributor.sourceType}-${contributor.sourceId}-${index}`}>
                <span className="causal-index">{String(index + 1).padStart(2, '0')}</span>
                <span className={`causal-dot ${isMetricChangeGood(explanation.metric, contributor.effect) ? 'is-good' : 'is-bad'}`} />
                <div><strong>{contributor.description}</strong><small>{contributor.path.join(' → ')}</small></div>
                {eventRoot && <button className="prove-cause-button" onClick={() => { if (event) useGameStore.getState().selectRegion(event.region); useGameStore.getState().proveIt(eventRoot.slice(6)); document.querySelector('.prove-it')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>PROVE IT ↗</button>}
                <b>{contributor.effect >= 0 ? '+' : ''}{contributor.effect.toFixed(2)}</b>
              </div>;
            })}
          </div>
        ) : <p className="muted">Advance the simulation to record the first monthly causal chain.</p>}
      </div>
    </section>
  );
}
