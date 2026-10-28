# TRAJECTA.AI - Cricket Intelligence Frontend

Modern, high-performance web dashboard for cricket bowling analytics, 3D stadium DRS trajectory visualization, and computer-vision ball tracking.

---

## Key Features

1. **3D Stadium DRS Viewer (Three.js)**
   - High-fidelity 3D Narendra Modi Stadium environment (`models/stadium.glb`).
   - 3D Cricket Ball (`models/cricket_ball.glb`) with realistic texture and seam.
   - Interactive camera modes: Ball POV Tracking, Dynamic Orbit, Top Pitch, Batsman Wicket, and Bowler Release.
   - Interactive timeline flight scrubber with instantaneous physics-derived speed (mph / km/h).

2. **Insights Command Center**
   - Live bowler spell metrics (Peak Pace, Good Length Accuracy, Channel Discipline, Aero Swing, Release Height).
   - Pitch length corridor dispersion heatmap (Full, Good, Back of Length, Short).
   - Lateral off-stump deviation and Hawk-Eye 3D stumps impact projections.

3. **Delivery Vision Studio**
   - Video upload and trim studio.
   - Ball detection bounding overlays, calibration grid, and trajectory paths.
   - Release, bounce, and stumps arrival telemetry.

4. **Spell Analytics & Multi-Ball Map**
   - Multi-delivery trajectory overlays on regulation 20.12m MCC pitch.
   - Ball-by-ball comparison and statistical breakdown.

5. **Theme Support**
   - Sleek dark theme and clean light theme toggle.

---

## Repository Structure

```
cric-frontend-/
├── index.html                  # Main application dashboard shell
├── styles.css                  # Design system, dark/light theme tokens, animations
├── app.js                      # Three.js 3D engine, charts, telemetry, API client
├── trajecta_logo.png           # Brand logo
├── trajecta_logo_tight.png     # Tight mark for navbar and watermark
├── vite.config.js              # Vite configuration with /api backend proxy
├── package.json                # NPM configuration
├── fonts/                      # Typography fonts
├── images/                     # Graphic assets and backgrounds
├── models/                     # 3D GLB assets (stadium, cricket ball)
├── samples/                    # Sample demonstration media
└── outputs/                    # Demonstration output deliveries
```

---

## Getting Started

### Option 1: Standalone Static Server

You can serve the frontend directly with any static file server:

```bash
# Using Python
python3 -m http.server 3000

# Or using npx serve
npx serve .
```

Open `http://localhost:3000` in your browser.

### Option 2: Vite Development Server (with API proxy)

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

The Vite dev server will run on `http://localhost:3000` and automatically proxy API calls (`/api/...`) to the backend running at `http://127.0.0.1:8000`.

---

## Backend Connection

This frontend connects to the TRAJECTA Python FastAPI backend via REST endpoints under `/api/`:
- `/api/sessions`: Manage bowling sessions and spells.
- `/api/detect-ball-video`: Run YOLO neural tracking on video deliveries.
