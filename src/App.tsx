import { useEffect } from 'react';
import { economicScenarios } from './economy/scenarios';
import { EVENT_PRESENTATION } from './economy/visualState';
import { Controls } from './components/Controls';
import { Dashboard, WhyInspector } from './components/Dashboard';
import { EventLog } from './components/EventLog';
import { ProveIt } from './components/ProveIt';
import { ScenarioRail } from './components/ScenarioRail';
import { WebMCPInspector } from './components/WebMCPInspector';
import { GameCanvas } from './game/GameCanvas';
import { useGameStore } from './store/useGameStore';

export default function App() {
  useEffect(() => {
    const demo = new URLSearchParams(window.location.search).get('demo');
    if (demo) useGameStore.getState().loadScenario(demo);
  }, []);

  const country = useGameStore((state) => state.country);
  const activeScenarioId = useGameStore((state) => state.activeScenarioId);
  const viewMode = useGameStore((state) => state.viewMode);
  const notice = useGameStore((state) => state.notice);
  const activeComparisonId = useGameStore((state) => state.activeComparisonId);
  const activeEvents = country.activeEvents;
  const scenario = economicScenarios.find((item) => item.id === activeScenarioId);
  const debugWebMCP = new URLSearchParams(window.location.search).get('webmcp-debug') === '1';

  return (
    <main className="app-shell">
      <header className="command-header">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true"><span>CL</span><i /></div>
          <div>
            <p className="eyebrow">CountryLab · National command</p>
            <h1>Lumenia <span>Economic Observatory</span></h1>
            <p>Run the country. Trace every consequence. Test another world.</p>
          </div>
        </div>
        <div className="header-status">
          <div className={`world-badge ${viewMode === 'alternate' ? 'is-alternate' : ''}`}><span /> {viewMode === 'alternate' ? 'ALTERNATE WORLD' : 'LIVE WORLD'}</div>
          <div className="date-block"><small>Simulation date</small><strong>Month {country.month}</strong><span>Year {Math.ceil(country.month / 12)} · Paused</span></div>
        </div>
      </header>

      <div className="product-loop" aria-label="CountryLab workflow">
        <span><b>01</b> Observe</span><i>→</i><span><b>02</b> Intervene</span><i>→</i><span><b>03</b> Ask why</span><i>→</i><span className="is-accent"><b>04</b> Prove it</span>
      </div>

      {notice && <div className="action-notice" role="status" aria-live="polite"><div><strong>{notice.message}</strong>{notice.detail && <span>{notice.detail}</span>}</div><button aria-label="Dismiss notification" onClick={() => useGameStore.getState().dismissNotice()}>Dismiss</button></div>}

      <ScenarioRail />
      {scenario && <div className="scenario-context"><strong>{scenario.title}</strong><span>{scenario.question}</span><button onClick={() => useGameStore.getState().restartScenario()}>Restart scenario</button><button onClick={() => useGameStore.getState().returnToBaseline()}>Return to baseline</button></div>}

      {activeComparisonId && <div className="alternate-return"><strong>You are comparing an alternate world.</strong><span>LIVE WORLD remains unchanged.</span><button onClick={() => useGameStore.getState().clearComparison()}>Return to live country</button><button onClick={() => useGameStore.getState().clearCounterfactuals()}>Clear comparisons</button></div>}

      <Dashboard />
      <div className="main-grid">
        <section className="world-card">
          <div className="world-card-heading"><div><p className="eyebrow">Live national terrain</p><h2>The economy, made visible</h2></div><span className="map-online"><i /> Telemetry online</span></div>
          <GameCanvas />
          {activeEvents.length > 0 && <div className="active-events" aria-label="Active events"><span className="eyebrow">Active intelligence</span>{activeEvents.map((event) => <button key={event.id} onClick={() => { useGameStore.getState().selectRegion(event.region); useGameStore.getState().proveIt(event.id); }}>{EVENT_PRESENTATION[event.type].label} · {country.regions[event.region].name} <small>{event.monthsRemaining}m</small></button>)}</div>}
        </section>
        <Controls />
      </div>
      <WhyInspector />
      <EventLog />
      <ProveIt />
      {debugWebMCP && <WebMCPInspector />}
      <footer><span>COUNTRYLAB / LUMENIA</span> Educational simulation only — a transparent model for learning, not a forecast or policy tool.</footer>
    </main>
  );
}
