# Runtime artwork

CountryLab ships one raster artwork asset used by the production application:

- `public/assets/reference/main-country-map.png` — the illustrated Lumenia terrain loaded by Phaser.

The repository previously contained additional concept/reference sheets, but they were not used by the runtime and have been removed from the submission tree.

Vehicles, region outlines, event effects, disruption/recovery effects, activity markers, labels, selection effects, charts, and the rest of the interface are rendered procedurally with Phaser, React and CSS.

The remaining map artwork is a generated project asset included with CountryLab; the submission does not depend on external runtime sprite packs, stock-image downloads, or third-party hosted artwork.
