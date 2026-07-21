# LLM Taxonomy Guide

[![DOI](https://zenodo.org/badge/1226361483.svg)](https://zenodo.org/badge/latestdoi/1226361483)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An interactive reference for large language models — architectures, tokenisation, attention,
embeddings, alignment, retrieval-augmented generation, and the current model landscape.

**Live:** https://llm-guide-uil6.vercel.app/

Built for researchers and students who want to understand how these systems actually work,
without assuming a machine-learning background. Includes interactive diagrams (a tokeniser,
an attention explorer, an MoE router, a LoRA parameter calculator, an embedding space, a RAG
pipeline), a ten-question quiz, and a searchable glossary.

---

## Companion paper

This tool covers **mechanism** — how the models work. Its companion paper covers
**governance** — how to use them responsibly in research:

> **Using AI Safely and Ethically in Research: A Practical Guide to the Large Language Model
> Landscape for Research Colleagues.** Barry Johnston, Atlantic Technological University,
> Version 1.0, July 2026. *(DOI pending deposit.)*

The paper addresses access routes and their trade-offs, data protection, verification,
disclosure and citation, intellectual property, and environmental cost. The two are designed
to be used together; the *Safe & ethical use* section of this tool summarises the paper and
links to it.

---

## Running locally

Requires Node.js 18+.

```bash
npm install
npm run dev      # dev server, usually http://localhost:5173
npm run build    # production build to dist/
npm run lint     # eslint
```

## Project structure

```
src/
  App.jsx           all components and content (single file)
  main.jsx          entry point
  data/models.json  model landscape data — do not edit directly (see below)
```

## Updating the model landscape

Model data is **not** hardcoded in `App.jsx`. It lives in `src/data/models.json`, which is a
copy of `shared/models.json` in the companion project — a single source of truth shared with
the paper, so the two cannot drift apart.

To update:

1. Edit `shared/models.json` in the parent project.
2. Run `shared/sync-models.sh` to copy it into `src/data/models.json`.
3. Rebuild both the site and the paper.

Each entry carries a `verify` flag. Entries marked `"verify": true` were drawn from secondary
reporting and should be checked against the
[Artificial Analysis Intelligence Index](https://artificialanalysis.ai/evaluations/artificial-analysis-intelligence-index)
before being relied upon.

**A note on benchmark figures.** Earlier versions displayed hardcoded MMLU / HumanEval / MATH
scores with no source. These were removed rather than carried forward. The tool now shows a
single sourced composite (the Artificial Analysis Intelligence Index) with an explicit as-of
date, and displays "—" where no sourced figure exists. Please do not reintroduce unsourced
benchmark numbers.

**This field moves very fast.** The leaderboard changed materially within a single month
during development. Treat every figure as perishable.

---

## Citation

If you use this software, please cite it using the metadata in [`CITATION.cff`](CITATION.cff).

## Licence

[MIT](LICENSE) © 2026 Barry Johnston, Atlantic Technological University.

## Built with

React 19 and Vite. No analytics, no tracking, no external data calls — everything runs
client-side.
