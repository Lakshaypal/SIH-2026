# Developer Handoff Documentation

Welcome to the OceanEmbed-PG codebase. This document outlines the project structure and architectural decisions to help incoming developers get up to speed quickly.

## Folder & File Structure

```text
/
├── app.js               # Main frontend JavaScript (Canvas routing, Plotly 3D, Leaflet, UI state)
├── index.html           # Main HTML structure and layout
├── styles.css           # Global stylesheets, CSS Grid/Flexbox layouts, Custom variables
├── server.mjs           # Node.js backend (Static server, SSE relayer, AIS WebSocket proxy)
├── package.json         # Node dependencies (e.g. ws for websockets)
├── .env                 # Environment variables (e.g. AISSTREAM_API_KEY)
├── .gitignore           # Ignored files (node_modules, logs, temp files)
├── README.md            # High-level overview
├── HANDOFF.md           # This document
│
├── OCEANEMBED_COMPLETE_DOCUMENTATION.txt                 # Comprehensive plain-text documentation
├── SIH_2026_COMPLETE_TECHNICAL_DOSSIER.md                # Markdown technical dossier with ML code
├── OceanEmbed_PG_SIH2026_Engineering_and_Data_Specification.pdf # Printable 5-page PDF
└── oceanembed_pg_theory_and_build_plan.html              # HTML source for the engineering PDF
```

## Architectural Overview

### 1. Frontend (`index.html`, `styles.css`, `app.js`)
- **Vanilla Stack**: The frontend strictly avoids heavy frameworks (React/Vue/Angular) in favor of Vanilla JS to minimize load time and ensure maximum frame rates (60+ FPS) when rendering 3D data and map overlays.
- **Maps**: Uses Leaflet.js with CartoDB Positron tiles for high-contrast white ocean cartography.
- **3D Visualization**: 
  - Type 1 (Voxel Point Cloud) is rendered using `Plotly.js` WebGL.
  - Type 2 (Solid Sliced Block) is drawn manually on HTML5 `<canvas>`.
- **Charts**: Chart.js is used for ARGO float profiling and time series trajectory plots.
- **CSS**: Uses a highly semantic custom property system. Colors are defined via `--bg-dark`, `--bg-light`, `--accent-primary` (Copper/Cyan), etc. Layout relies heavily on CSS Grid (bento boxes) and Flexbox (zig-zags).

### 2. Backend (`server.mjs`)
- **Zero-Dependency Microserver**: Uses native Node.js `http` and `fs` modules to serve static files (.html, .css, .js, .pdf, .txt, .md).
- **WebSocket Streaming**: Uses `node --experimental-websocket` to proxy AISStream data.
- **SSE (Server-Sent Events)**: Exposes `/api/ais/stream` so the client can subscribe to live ship position updates via `EventSource` without needing a heavy socket.io client payload.

## Immediate Next Steps for Integration
1. **Machine Learning API Hookup**: The frontend currently uses localized mock physics data to render charts. The next step is to replace the `fetchMockData()` logic in `app.js` with actual `fetch('/api/soundings')` calls communicating with a deployed PyTorch/ONNX inference server.
2. **Database Integration**: Consider adding PostgreSQL/PostGIS to the backend if you need to track historical AIS vessel routes rather than just live points.
3. **Responsive Testing**: Continue testing mobile responsiveness on small screens, particularly the intricate table layouts and Plotly 3D canvas resize observers.
