# Matching evaluation

`npm run eval:matching` runs the real pipeline steps (attribute extraction, multimodal embedding and pair reranking) over labelled pairs. It reports precision, recall and F1 at `MATCH_THRESHOLD`, and writes `results.md`.

It needs a `GEMINI_API_KEY`. Each pair costs 5 model calls: 2 extractions, 2 embeddings and 1 rerank. The script waits out the free-tier rate limit by itself.

## Data

Put photos in `images/` and describe the pairs in `pairs.json`:

```json
[
  {
    "id": "wallet-01",
    "isMatch": true,
    "note": "same wallet, photographed at home vs. on a bench",
    "lost":  { "image": "wallet-01-lost.jpg",  "fields": { "category": "Wallet", "colors": ["brown"], "description": "Brown leather wallet, torn corner" } },
    "found": { "image": "wallet-01-found.jpg", "fields": { "category": "Wallet", "description": "Found a wallet near the bus stop" } }
  }
]
```

A useful set has about 30 pairs. Half should be true pairs: the same object photographed by two people, in different light and from different angles. The other half should be **hard negatives**: different objects of the same kind and color, such as two black iPhones or two silver key rings. Hard negatives are what tell you whether the model looks at identifying details or only at the category.

Use only photos you took yourself or have the rights to.
