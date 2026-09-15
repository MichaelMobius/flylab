# Third-party notices and scientific provenance

## Three.js

FlyLab bundles Three.js 0.186.0 under `vendor/three`. Three.js is MIT licensed; its license is included with the vendored files.

## `Lulzx/fly-brain`

FlyLab adapts browser-connectome codec conventions, LIF modeling conventions, descending-neuron motor roles/readout constants, and the rationale for an endogenous-behavior drive from the open-source `Lulzx/fly-brain` project (MIT License, copyright 2026 lulzx).

For reproducibility, FlyLab mirrors the four compact files it needs under `data/malecns/` from the pinned source commit:

```text
4a8a8ebe2b8713106b605f5e32bc8458d65e0f16
```

Mirrored files:

- `graph.flyg`
- `neurons.flyn`
- `meta.json`
- `bodymap.json`

`data/malecns/MANIFEST.json` records file sizes, source paths and SHA-256 checksums. The mirror is a reproducibility convenience; it does not transfer ownership or alter upstream licensing/attribution requirements.

## MaleCNS dataset

MaleCNS v1.0 is a collaboration involving FlyEM at HHMI Janelia, the University of Cambridge Department of Zoology, the MRC Laboratory of Molecular Biology, and Google Research. The official MaleCNS distribution is released with attribution requirements documented by the project. FlyLab's use of the compact preprocessed connectivity does not remove those requirements.

When redistributing or publishing results based on this data, cite the MaleCNS dataset/publication and the upstream representation from which the compact files were mirrored.

## Odor and sensory mapping

The banana odor-to-glomerulus mapping and identified sensory-population conventions are based on the open browser MaleCNS reference implementation. Other FlyLab fruit odor signatures remain provisional model inputs, not calibrated receptor-response atlases.

## Scientific interpretation

The connectome is structural data. It does not by itself determine membrane dynamics, synaptic physiology, neuromodulation, plasticity, sensory transduction or complete motor biomechanics. FlyLab labels these assumptions explicitly and retains Proxy/Observe/Control conditions to separate modeled control from connectome-derived activity.

See `docs/SCIENTIFIC_LIMITATIONS.md` for the current interpretation boundary.
