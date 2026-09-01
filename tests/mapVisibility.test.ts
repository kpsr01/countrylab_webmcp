import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const canvasSource = readFileSync(new URL('../src/game/GameCanvas.tsx', import.meta.url), 'utf8');
const overlayStyles = readFileSync(new URL('../src/game/mapActivityOverlay.css', import.meta.url), 'utf8');

test('map activity readout is rendered above Phaser without intercepting map input', () => {
  assert.match(canvasSource, /selectDisasterWorldPresentation\(country\)/);
  assert.match(canvasSource, /className="map-activity-overlay"/);
  assert.match(overlayStyles, /\.map-activity-overlay\s*\{[\s\S]*z-index:\s*4;/);
  assert.match(overlayStyles, /\.map-activity-overlay\s*\{[\s\S]*pointer-events:\s*none;/);
});

test('all five economic regions expose a foreground throughput signal', () => {
  for (const region of ['farmbelt', 'energy', 'capital', 'industrial', 'port']) {
    assert.match(canvasSource, new RegExp(`region: '${region}'`));
    assert.match(overlayStyles, new RegExp(`\\.map-flow-${region}`));
  }
  assert.match(canvasSource, /Array\.from\(\{ length: 5 \}/);
});
