import { useGameStore } from '../store/useGameStore';
import { selectTimeline, type TimelineItem } from '../economy/visualState';

function humanCause(cause: string) {
  if (cause.startsWith('event:')) return 'Major event';
  if (cause.startsWith('policy:')) return `${cause.slice(7).replace(/([A-Z])/g, ' $1').trim()} policy`;
  return cause.replace(/_/g, ' ');
}

export function EventLog() {
  const country = useGameStore((s) => s.country);
  const selectedId = useGameStore((s) => s.selectedTimelineId);
  const timeline = selectTimeline(country);
  const selected = timeline.find((item) => item.id === selectedId) ?? timeline[0];

  function selectItem(item: TimelineItem) {
    const eventId = item.causes.find((cause) => cause.startsWith('event:'))?.slice(6);
    const event = eventId ? country.eventHistory.find((candidate) => candidate.id === eventId) : null;
    useGameStore.getState().selectTimelineItem(item.id, item.metric, event?.region);
  }

  return (
    <section className="log-panel" aria-label="Simulation timeline">
      <div className="log-header"><div><p className="eyebrow">Timeline · month {country.month}</p><h2>What changed</h2></div><span>{country.activeEvents.length} active shock{country.activeEvents.length === 1 ? '' : 's'}</span></div>
      <div className="timeline">
        {timeline.map((item) => <button className={`timeline-item kind-${item.kind} ${selected?.id === item.id ? 'is-selected' : ''}`} key={item.id} onClick={() => selectItem(item)} aria-pressed={selected?.id === item.id}>
          <span className="timeline-month">M{item.month}</span><span className="timeline-type">{item.kind === 'event' ? 'Shock' : item.kind === 'policy' ? 'Policy' : item.kind === 'consequence' ? 'Result' : 'System'}</span><strong>{item.title.replace(/^Policy changed: /, '')}</strong><small>{item.detail}</small>
        </button>)}
      </div>
      {selected && <div className="timeline-detail">
        <div><span className={`timeline-badge kind-${selected.kind}`}>{selected.kind === 'event' ? 'Shock' : selected.kind === 'policy' ? 'Policy' : selected.kind === 'consequence' ? 'Result' : 'System'}</span><span>Month {selected.month}</span></div>
        <strong>{selected.title.replace(/^Policy changed: /, '')}</strong><p>{selected.detail}</p>
        {selected.causes.length > 0 && <small><b>Chain</b> {selected.causes.map(humanCause).join(' · ')}</small>}
        {(() => {
          const eventId = selected.causes.find((cause) => cause.startsWith('event:'))?.slice(6);
          const event = eventId ? country.eventHistory.find((candidate) => candidate.id === eventId) : null;
          return event && <button className="timeline-prove" onClick={() => { useGameStore.getState().selectRegion(event.region); useGameStore.getState().proveIt(event.id); document.querySelector('.prove-it')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>PROVE THIS SHOCK</button>;
        })()}
      </div>}
    </section>
  );
}
