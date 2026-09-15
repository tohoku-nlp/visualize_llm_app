# JSON-based detail rendering plan

## Goal

Replace Matplotlib-generated PNG detail images with JSON payloads rendered by the
React frontend. The backend should only run the model, extract compact data for
each node, and mark nodes ready when the JSON data is available.

## Current bottleneck

- The backend generates many PNG files with Matplotlib.
- Each clicked node returns base64-encoded image data.
- GPT-2 small has 144 attention heads, so image rendering and disk I/O dominate
  perceived latency after the model cache is ready.
- Matplotlib also creates thread/backend issues on macOS when used from FastAPI
  background threads.

## Target behavior

- Keep the current async job model.
- Keep the current SVG graph and ready/pending node behavior.
- Make Output and high layers ready first.
- Return attention/logits detail data as JSON.
- Render the modal using HTML/SVG/CSS in React.
- Avoid writing per-node image files.

## Backend design

Each ready node stores structured detail data:

```json
{
  "node": "A11.H3",
  "kind": "attention",
  "rank": 42,
  "attention": {
    "tokens": ["Sendai", "_is", "_located"],
    "values": [[1.0, 0.0, 0.0], [0.3, 0.7, 0.0], [0.2, 0.2, 0.6]]
  },
  "logits": {
    "tokens": [" Japan", " Tokyo", " Osaka"],
    "values": [12.3, 9.8, 8.1]
  }
}
```

Implementation notes:

- Compute `layer_logits` and `head_logits` once as today.
- For logits details, convert top-k token ids and values to JSON.
- For attention details, convert the selected attention matrix to nested lists.
- Round float values to reduce response size.
- Reuse the existing reverse-priority generation order:
  - final MLP and Output first
  - remaining MLPs from high layer to low layer
  - attention heads from high layer to low layer

## Frontend design

Add two rendering components:

- `AttentionHeatmap`
  - SVG grid of `<rect>` cells
  - token labels on both axes
  - blue intensity based on attention weight
- `LogitsRanking`
  - HTML/CSS list or bar chart
  - top token and logit value rows

Update `ImageModal` into a data-detail modal:

- Attention nodes show heatmap and logits side by side.
- MLP and Output nodes show logits only.
- Existing node tooltip/rank behavior remains unchanged.

## Migration strategy

Do this as a direct replacement rather than a compatibility layer. The current
React frontend is new enough that supporting both image and JSON detail payloads
is not necessary.

## Verification

- `./.venv/bin/python -m compileall backend.py prompt.py`
- `npm run build`
- Manual browser check:
  - start backend and frontend
  - run one sample
  - confirm Output becomes clickable before attention heads
  - confirm attention modal renders a heatmap without PNG/base64 payloads
