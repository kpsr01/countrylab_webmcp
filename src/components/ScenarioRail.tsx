import { economicScenarios } from '../economy/scenarios';
import { useGameStore } from '../store/useGameStore';

export function ScenarioRail() {
  const activeScenarioId = useGameStore((state) => state.activeScenarioId);
  const icons = ['≈', 'ϟ', '%', '⇄', '☼', '↗'];
  return (
    <section className="scenario-rail" aria-labelledby="scenario-heading">
      <div className="scenario-rail-heading">
        <div>
          <p className="eyebrow">Scenario launcher</p>
          <h2 id="scenario-heading">Deploy a known crisis</h2>
        </div>
        <span className="scenario-rail-note"><i /> Six reproducible starting worlds</span>
      </div>
      <div className="scenario-grid">
        {economicScenarios.filter((scenario) => scenario.id !== 'banking-crisis').map((scenario, index) => (
          <button className={`scenario-card ${activeScenarioId === scenario.id ? 'is-active' : ''}`} key={scenario.id} onClick={() => useGameStore.getState().loadScenario(scenario.id)}>
            <i className="scenario-icon">{icons[index] ?? '◇'}</i>
            <span><small>{scenario.concepts[0]}</small><strong>{scenario.title}</strong></span>
            <b>{activeScenarioId === scenario.id ? 'ACTIVE' : 'LOAD'} ↗</b>
          </button>
        ))}
      </div>
    </section>
  );
}
