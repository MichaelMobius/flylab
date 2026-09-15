# Optional local MaleCNS data

FlyLab does not bundle the connectome binaries by default.

To self-host the compact MaleCNS bridge, copy these files here:

- `neurons.flyn`
- `graph.flyg`
- `meta.json`
- `bodymap.json`

Then open FlyLab in observation mode with:

```text
?brain=observe&malecnsBase=./data/
```

or in descending-neuron control mode with:

```text
?brain=control&malecnsBase=./data/
```

The legacy alias `?brain=malecns` still resolves to observation mode. The default remote source is pinned to the `Lulzx/fly-brain` commit documented in `README.md`.
