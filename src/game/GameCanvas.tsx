import { useEffect, useRef } from 'react';
import * as Phaser from 'phaser';
import { EconomyScene } from './EconomyScene';
import { EVENT_PRESENTATION } from '../economy/visualState';
import { useGameStore } from '../store/useGameStore';

export function GameCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const country = useGameStore((state) => state.country);

  useEffect(() => {
    if (!hostRef.current) return;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: hostRef.current,
      width: 960,
      height: 660,
      backgroundColor: '#07131f',
      scene: [EconomyScene],
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 960,
        height: 660,
      },
      render: { antialias: true },
    });
    return () => game.destroy(true);
  }, []);

  const regionSummary = Object.values(country.regions)
    .map((region) => `${region.name}: health ${region.health.toFixed(0)}, productivity ${region.productivity.toFixed(0)}`)
    .join('; ');
  const eventSummary = country.activeEvents.length
    ? `Active events: ${country.activeEvents.map((event) => `${EVENT_PRESENTATION[event.type].label} in ${country.regions[event.region].name}`).join(', ')}.`
    : 'No active shocks.';

  return (
    <div className="game-scroll">
      <div ref={hostRef} className="game-host" role="img" aria-label="Interactive country simulation map" aria-describedby="country-map-summary" />
      <p id="country-map-summary" className="sr-only">Month {country.month}. {eventSummary} Regions: {regionSummary}. Use the region controls beside the map for keyboard-accessible inspection.</p>
      <div className="map-help"><span><i /> Hover to scan</span><span><b>↗</b> Click a district for intelligence</span></div>
    </div>
  );
}
