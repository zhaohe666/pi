# ImgKits Clone

An AI image & video editor clone of [imgkits.com](https://www.imgkits.com/) with:

- **Backend**: Node.js + Express + Swagger / OpenAPI 3.0
- **Frontend**: Vanilla HTML/CSS/JS with imgkits-style UI (gradient hero, tool grid, pricing, modal editor)

## Quick start

```bash
npm install
npm start
```

Then open:

- Frontend: <http://localhost:3000>
- Swagger UI: <http://localhost:3000/api/docs>
- OpenAPI JSON: <http://localhost:3000/api/openapi.json>

## API Endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET  | `/api/health` | Service health check |
| GET  | `/api/tools` | List all available AI tools |
| POST | `/api/tools/background-remover` | Remove image background |
| POST | `/api/tools/background-replace` | Replace background with AI scene |
| POST | `/api/tools/photo-restore` | Restore old / damaged photos |
| POST | `/api/tools/unblur` | Sharpen blurry images |
| POST | `/api/tools/upscale` | Upscale up to 8x |
| POST | `/api/tools/object-remove` | Remove objects via mask |
| POST | `/api/tools/style-transfer` | Photo to anime / pixar / sketch / etc. |
| POST | `/api/tools/flyer-generator` | Generate flyer from prompt |
| POST | `/api/tools/fantasy-map` | Generate fantasy map |
| GET  | `/api/jobs` | List recent jobs |
| GET  | `/api/jobs/{jobId}` | Poll job status / result |

All processing endpoints return `202 Accepted` with a `jobId`. Poll
`GET /api/jobs/{jobId}` until `status === "done"` to get `resultUrl`.

## Project layout

```
backend/
  server.js           Express app, Swagger setup, static hosting
  routes/api.js       AI tool endpoints with OpenAPI annotations
public/
  index.html          Hero, tool grid, features, pricing, footer, modal
  css/styles.css      imgkits-style theme (purple to cyan gradients)
  js/app.js           Loads tools, opens modal, runs jobs, polls status
```

## Notes

The tool endpoints are mock implementations that return placeholder result
URLs after a short delay. Wire them up to a real model (Replicate, Hugging
Face, your own) by replacing the `setTimeout` callbacks in
`backend/routes/api.js`.
