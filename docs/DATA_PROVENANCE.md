# MaleCNS data provenance

FlyLab mirrors the compact browser representation required by its MaleCNS bridge from:

- repository: `https://github.com/Lulzx/fly-brain`
- pinned commit: `4a8a8ebe2b8713106b605f5e32bc8458d65e0f16`
- upstream path: `public/data/`

The mirror is stored in `data/malecns/` so the core MaleCNS modes do not depend on the continued availability of another repository at runtime.

## Mirrored files

| file | bytes | SHA-256 |
| --- | ---: | --- |
| `graph.flyg` | 14,623,114 | `ed3df5a7ec8610bdaa7f42b49d0970bca3afa7c9e041ff1c025c6d2f9173fff5` |
| `neurons.flyn` | 1,006,198 | `91630046af02826299834179bb07726d1ed9b7dd1426e90315c011e42011f6e7` |
| `meta.json` | 3,178,974 | `580c2d5a210469a6ab1184ae2187dcc4ce8217c6f74043bd2e585c7b110ec36a` |
| `bodymap.json` | 235,718 | `10630cd4c7a6cc2c1dcfcbee4a602d307f06766f316b185f631406813a58da9d` |

The machine-readable version is `data/malecns/MANIFEST.json`.

## Refresh procedure

`.github/workflows/mirror-malecns.yml` can be run manually if the pinned source is intentionally changed. Updating the source commit should be treated as a scientific/data-version change: regenerate the manifest, run the complete test suite and record the change in `CHANGELOG.md`.

## License and attribution

The mirror does not change ownership or licensing. Preserve the MaleCNS dataset and upstream implementation attribution described in `THIRD_PARTY_NOTICES.md` when redistributing the data or publishing results.
