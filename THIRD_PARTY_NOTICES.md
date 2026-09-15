# Third-party notices and scientific provenance

## Three.js

FlyLab bundles Three.js 0.186.0 under `vendor/three`. Three.js is MIT licensed; its license is included with the bundled package.

## `Lulzx/fly-brain`

FlyLab 1.0 adapts the browser-connectome codec structure, LIF modeling conventions, descending-neuron motor roles/readout constants, and the rationale for an endogenous-behavior drive from the open-source `Lulzx/fly-brain` project (MIT License, copyright 2026 lulzx). The local files under `src/malecns/` are an integration-oriented subset/reimplementation for FlyLab and preserve attribution here.

FlyLab does not bundle the large MaleCNS graph files in its default ZIP. At runtime, `MaleCNS Observe` or `MaleCNS Control` fetches the compact `neurons.flyn`, `graph.flyg`, `meta.json`, and `bodymap.json` files from the public reference repository, pinned to commit `4a8a8ebe2b8713106b605f5e32bc8458d65e0f16`, unless a custom `malecnsBase` is supplied.

## MaleCNS dataset

MaleCNS v1.0 is a collaboration between FlyEM at HHMI Janelia, the University of Cambridge Department of Zoology, the MRC Laboratory of Molecular Biology, and Google Research. The official MaleCNS download page states that the dataset is licensed under CC-BY.

FlyLab's use of compact preprocessed connectivity is intended for research/educational experimentation and does not change the need to preserve dataset attribution.

## Odor and sensory mapping

The banana odor-to-glomerulus mapping and the identified sensory-population conventions are based on the open browser MaleCNS reference implementation. Other FlyLab fruit odor signatures remain provisional model inputs, not calibrated receptor-response atlases.

## Scientific interpretation

The connectome is structural data. A structural connectome does not by itself determine membrane dynamics, synaptic physiology, neuromodulation, plasticity, sensory transduction or complete motor biomechanics. FlyLab explicitly labels such assumptions and retains the Proxy controller as a comparison condition.
