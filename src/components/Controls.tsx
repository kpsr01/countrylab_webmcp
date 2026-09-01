import { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import type { EventType, PolicyKey, RegionId } from '../economy/types';
import { selectRegionInspector } from '../economy/visualState';
import { getRegionEntities, REGION_PRESENTATION } from '../game/worldModel';

const regions: RegionId[] = ['capital', 'farmbelt', 'industrial', 'port', 'energy'];
const events: { type: EventType; label: string; icon: string; defaultRegion: RegionId }[] = [
  { type: 'flood', label: 'Flood', icon: '≈', defaultRegion: 'port' },
  { type: 'drought', label: 'Drought', icon: '☼', defaultRegion: 'farmbelt' },
  { type: 'war', label: 'Trade conflict', icon: '⇄', defaultRegion: 'industrial' },
  { type: 'oil_shock', label: 'Energy shock', icon: 'ϟ', defaultRegion: 'energy' },
  { type: 'banking_crisis', label: 'Bank crisis', icon: '⌁', defaultRegion: 'capital' },
  { type: 'productivity_boom', label: 'Productivity boom', icon: '↗', defaultRegion: 'industrial' },
];

const policyDefinitions: Partial<Record<PolicyKey, string>> = {
  interestRate: 'Cost of borrowing',
  incomeTax: 'Household tax rate',
  corporateTax: 'Business tax rate',
  governmentSpending: 'Public investment index',
  tariffRate: 'Tax on imported goods',
  emergencySpending: 'Disaster response fund',
};

const policies: { key: PolicyKey; label: string; min: number; max: number; step: number; suffix: string }[] = [
  { key: 'interestRate', label: 'Interest rate', min: 0, max: 20, step: 0.5, suffix: '%' },
  { key: 'incomeTax', label: 'Income tax', min: 0, max: 60, step: 1, suffix: '%' },
  { key: 'corporateTax', label: 'Corporate tax', min: 0, max: 60, step: 1, suffix: '%' },
  { key: 'governmentSpending', label: 'Gov. spending', min: 0, max: 100, step: 1, suffix: '' },
  { key: 'tariffRate', label: 'Tariff', min: 0, max: 50, step: 1, suffix: '%' },
  { key: 'emergencySpending', label: 'Emergency fund', min: 0, max: 100, step: 1, suffix: '' },
];

export function Controls() {
  const [mode, setMode] = useState<'events' | 'policies'>('events');
  const country = useGameStore((s) => s.country);
  const selected = useGameStore((s) => s.selectedRegion);
  const inspector = selected ? selectRegionInspector(country, selected) : null;

  return (
    <aside className="control-panel">
      <div className="control-heading">
        <div><p className="eyebrow">Command center</p><h2>Shape the country</h2></div>
        <span className="control-ready"><i /> Ready</span>
      </div>

      <div className="time-controls">
        <div><small>Current position</small><strong>M{country.month}</strong><span>Year {Math.ceil(country.month / 12)}</span></div>
        <div className="time-actions"><button className="primary" onClick={() => useGameStore.getState().advance(1)}>Advance 1m <b>→</b></button><button onClick={() => useGameStore.getState().advance(6)}>+6m</button></div>
      </div>

      <section className={`selected-region ${inspector ? 'has-selection' : ''}`}>
        <div className="selected-region-heading">
          <div><p className="eyebrow">Regional intelligence</p><strong>{inspector ? country.regions[inspector.id].name : 'Select a district'}</strong></div>
          {inspector && <span className={`region-role status-${inspector.status}`}><i /> {inspector.status}</span>}
        </div>
        {inspector ? (
          <>
            <p className="region-description">{REGION_PRESENTATION[inspector.id].description}</p>
            <div className="region-health"><span>Infrastructure health <b>{inspector.health.toFixed(0)}%</b></span><i><em style={{ width: `${inspector.health}%` }} /></i></div>
            <div className="region-stats"><span><small>Productivity</small><b>{inspector.productivity.toFixed(0)}</b></span><span><small>Capacity</small><b>{inspector.capacity.toFixed(0)}</b></span></div>
            {inspector.activeEffects.some((effect) => effect.active) && <div className="inspector-effects">{inspector.activeEffects.filter((effect) => effect.active).slice(0, 3).map((effect) => <span key={effect.id}>{effect.label} · {effect.monthsRemaining}m</span>)}</div>}
            <div className="entity-list">{getRegionEntities(inspector.id).slice(0, 5).map((entity) => <span key={entity.id}>{entity.label}</span>)}</div>
            <div className="region-metrics">{inspector.metrics.slice(0, 4).map((metric) => <span key={metric.key}><small>{metric.label}</small><b>{metric.value.toFixed(1)}</b></span>)}</div>
          </>
        ) : <p className="region-empty"><span>⌖</span> Select a glowing district on the map to reveal facilities, health, output, and active disruption.</p>}
        <div className="region-chips">{regions.map((region) => <button aria-pressed={selected === region} className={selected === region ? 'active' : ''} key={region} onClick={() => useGameStore.getState().selectRegion(region)}>{REGION_PRESENTATION[region].label.replace(' District', '')}</button>)}</div>
      </section>

      <div className="control-tabs" role="tablist" aria-label="Intervention type">
        <button role="tab" aria-selected={mode === 'events'} className={mode === 'events' ? 'active' : ''} onClick={() => setMode('events')}><span>01</span> Trigger event</button>
        <button role="tab" aria-selected={mode === 'policies'} className={mode === 'policies' ? 'active' : ''} onClick={() => setMode('policies')}><span>02</span> Tune policy</button>
      </div>

      {mode === 'events' ? (
        <div className="event-panel" role="tabpanel">
          <div className="panel-intro"><strong>Stress-test Lumenia</strong><span>Every shock changes the same deterministic state.</span></div>
          <div className="event-buttons">
            {events.map((event) => {
              const target = selected === event.defaultRegion ? selected : event.defaultRegion;
              return <button key={event.type} onClick={() => useGameStore.getState().addEvent(event.type, target)}><i>{event.icon}</i><span><strong>{event.label}</strong><small>{REGION_PRESENTATION[target].label}</small></span><b>+</b></button>;
            })}
          </div>
        </div>
      ) : (
        <div className="policy-panel" role="tabpanel">
          <div className="panel-intro"><strong>National policy</strong><span>Changes apply to the live world immediately.</span></div>
          {policies.map((policy) => (
            <label className="slider-row" key={policy.key}>
              <span><span><b>{policy.label}</b><small>{policyDefinitions[policy.key]}</small></span><output>{country.policies[policy.key]}{policy.suffix}</output></span>
              <input aria-label={policy.label} type="range" min={policy.min} max={policy.max} step={policy.step} value={country.policies[policy.key]} onChange={(event) => useGameStore.getState().setPolicy(policy.key, Number(event.target.value))} />
            </label>
          ))}
        </div>
      )}

      <div className="control-footer"><button onClick={() => useGameStore.getState().createSnapshot()}>Save live snapshot</button><button className="reset-control" onClick={() => useGameStore.getState().reset()}>Reset country</button></div>
    </aside>
  );
}
