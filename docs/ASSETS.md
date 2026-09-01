# Assets

CountryLab bundles five generated reference/concept images under `public/assets/reference/`:

- `main-country-map.png`
- `terrain-tiles.png`
- `buildings-structures.png`
- `disaster-event-overlays.png`
- `economy-ui-icons.png`

## Runtime use

The production runtime currently loads `main-country-map.png` as the illustrated Lumenia terrain. Vehicles, region outlines, event effects, activity markers, selection effects, labels, and most UI graphics are drawn procedurally by Phaser/CSS rather than requiring separate sprite atlases.

The other four files remain bundled as art-direction/reference sheets and are not required for application execution.

## Submission provenance check

Before public submission, record the generation/source provenance for these images and confirm that the team has the rights required by the challenge rules to publish and demonstrate them. Do not add third-party assets unless their license permits repository distribution and hackathon use.
