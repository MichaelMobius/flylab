# MaleCNS data mirror

FlyLab keeps the compact MaleCNS files required by the browser bridge in `data/malecns/`.

The mirror is generated from the pinned `Lulzx/fly-brain` commit:

```text
4a8a8ebe2b8713106b605f5e32bc8458d65e0f16
```

Expected files:

```text
data/malecns/graph.flyg
data/malecns/neurons.flyn
data/malecns/meta.json
data/malecns/bodymap.json
data/malecns/MANIFEST.json
```

`MANIFEST.json` records SHA-256 checksums, file sizes and source paths. See `../THIRD_PARTY_NOTICES.md` for attribution and licensing notes.

A custom data base can still be supplied with the `malecnsBase` query parameter for controlled experiments.
