# Sketchly

**A browser-based collaborative diagramming tool with CNN shape recognition and Java code generation.**

**Live demo: [www.sketchly.ie](https://www.sketchly.ie)**

Sketchly closes the gap between formal diagramming editors (Visio, Lucidchart, draw.io) and freehand sketching tools (Excalidraw). Users draw shapes by hand and a Convolutional Neural Network running entirely in the browser converts each stroke into a clean vector diagram element in real time. Multiple users can edit the same diagram concurrently via CRDTs, and a completed UML class diagram can be converted to executable Java source code with a single click.

This repository contains the full source code for my Final Year Project (B.Sc. Hons in Software Development, Atlantic Technological University, Galway).

---

## Features

- **Real-time freehand shape recognition.** A CNN trained on 100,000 synthetic images classifies hand-drawn strokes into ten classes (circle, square, rectangle, triangle, diamond, four directional arrows, line) at 5–20 ms per stroke, running fully in the browser via TensorFlow.js. A geometric corner-counting stage post-processes the CNN result and corrects misclassifications based on the physical structure of the stroke.
- **UML class diagram support.** Drawing a rectangle or square produces a three-compartment UML class box with editable text areas for the class name, attributes, and methods. The shape auto-resizes to its content and preserves the cursor position across re-renders.
- **Real-time multi-user collaboration.** Multiple users can edit the same diagram simultaneously through a Yjs-based CRDT layer. Concurrent edits converge without lost or duplicated shapes, and live cursors are broadcast over the Yjs awareness protocol.
- **Intelligent connector routing.** Line connectors are routed as orthogonal paths using a grid-based A\* pathfinder that avoids passing through other shapes on the canvas, with a per-turn bend penalty to keep paths visually clean.
- **AI-powered Java code generation.** A completed UML diagram can be exported to Java with one click. The canvas is rendered to a PNG and sent to the Anthropic Claude API, which produces Java class definitions matching the diagram's structure (inheritance, fields, method signatures). The output is cleaned up (markdown fences stripped, missing imports injected, `public` modifiers added) and presented in a modal with Copy and Save Files options.
- **Diagram persistence and authentication.** User accounts and saved diagrams are backed by Supabase (PostgreSQL + Auth). An auto-save handler debounces writes to once every five seconds.
- **Share-by-link rooms.** Each diagram has a shareable URL; opening it in another browser joins the same Yjs room.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript 5.9, Vite 7, tldraw 4.1, TensorFlow.js 4.22 |
| Collaboration | Yjs 13.6 + y-websocket |
| Backend | Node.js 20, Express.js 5.1, Anthropic SDK 0.84 |
| Database / Auth | Supabase (PostgreSQL + Auth) |
| ML training | Python, TensorFlow / Keras 2.15 |
| Deployment | Docker (multi-stage), [Railway](https://railway.app) |

---

## Repository Layout

```
sketchly/
├── frontend/      React + TypeScript single-page app (Vite)
├── backend/       Express server: Java code-gen REST + Yjs WebSocket
├── training/      Python CNN training pipeline (offline)
├── Dockerfile     Multi-stage build for Railway deployment
└── README.md      This file
```

---

## Live Deployment (Railway)

Sketchly is deployed at **[www.sketchly.ie](https://www.sketchly.ie)** as a single Node.js service on [Railway](https://railway.app), using the [Dockerfile](Dockerfile) at the project root. The custom domain is wired to the Railway service via a CNAME record. The Dockerfile is a multi-stage build:

1. **Frontend stage** — installs `frontend/` dependencies with npm, then runs `npm run build` to produce a Vite production bundle.
2. **Backend stage** — installs `backend/` dependencies with pnpm and compiles the TypeScript server with `pnpm run build`.
3. **Runtime stage** — copies the compiled backend (`dist/`) and the built frontend (into `public/`), installs production-only backend dependencies, and runs `node dist/server.js`.

The runtime server (`backend/src/server.ts`) does three things on Railway's single `$PORT`:

- Serves the static frontend bundle from `public/`.
- Exposes the `POST /api/generate-java` REST endpoint that proxies to the Anthropic API.
- Accepts WebSocket upgrades and hands them to `y-websocket` for real-time collaboration — so HTTP and WebSocket share the same port (Railway exposes only one).

### Railway environment variables

The following variables are configured on the Railway project:

**Build-time** (Vite inlines these into the bundle, so they must be set as Docker build args):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_TLDRAW_LICENSE_KEY`

**Runtime** (read by the Express server):
- `ANTHROPIC_API_KEY` — Anthropic API key for Java code generation
- `CORS_ORIGIN` — allowed origin (defaults to `*`)
- `PORT` — provided automatically by Railway

Pushing to the `main` branch triggers an automatic Railway build and redeploy.

---

## Running Locally

### Prerequisites

- Node.js 20+
- npm (frontend) and pnpm (backend) — install pnpm with `corepack enable && corepack prepare pnpm@latest --activate`
- A Supabase project (free tier is sufficient) — used for accounts and saved diagrams
- An Anthropic API key — used for Java code generation
- Python 3.10+ (only required if you want to retrain the CNN model)

### 1. Clone the repository

```bash
git clone https://github.com/HammadMubarik/sketchly.git
cd sketchly
```

### 2. Configure environment variables

Create `frontend/.env.local` with:

```bash
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
VITE_TLDRAW_LICENSE_KEY=<your-tldraw-license-key>
VITE_BACKEND_URL=http://localhost:5000
VITE_WS_URL=ws://localhost:1234
```

Create `backend/.env` with:

```bash
ANTHROPIC_API_KEY=<your-anthropic-api-key>
PORT=5000
CORS_ORIGIN=http://localhost:5173
```

### 3. Install dependencies and run

In one terminal, run the frontend:

```bash
cd frontend
npm install
npm run dev
```

In a second terminal, run the backend (Java code-gen REST + integrated Yjs WebSocket on port 5000):

```bash
cd backend
pnpm install
pnpm run dev
```

(Optional) In a third terminal, if you prefer to run the Yjs WebSocket as a standalone process on port 1234 (matches `VITE_WS_URL` above):

```bash
cd backend
pnpm run yjs
```

Open [http://localhost:5173](http://localhost:5173) in your browser. Sign up for an account, then start drawing.

### 4. Production build (locally)

To reproduce what Railway builds:

```bash
docker build -t sketchly \
  --build-arg VITE_SUPABASE_URL=... \
  --build-arg VITE_SUPABASE_ANON_KEY=... \
  --build-arg VITE_TLDRAW_LICENSE_KEY=... \
  .

docker run -p 5000:5000 \
  -e ANTHROPIC_API_KEY=... \
  -e PORT=5000 \
  sketchly
```

Then open [http://localhost:5000](http://localhost:5000).

---

## Retraining the CNN (Optional)

The trained TensorFlow.js model is committed to `frontend/public/models/shape-recognizer/`, so retraining is not required to run the app. To regenerate it from scratch:

```bash
cd training
python -m venv venv
source venv/bin/activate    # on Windows: venv\Scripts\activate
pip install -r requirements.txt
python train_model.py
```

The script generates 100,000 synthetic images (10,000 per class) with hand tremor, elastic deformation, stroke-speed, and stroke-truncation augmentation, trains the CNN, evaluates it on a held-out 10% split, and exports the weights directly into `frontend/public/models/shape-recognizer/`. Training takes around 10–20 minutes on Apple Silicon.

---

## How It Works (Brief)

1. The user draws a stroke on the tldraw canvas.
2. On pointer-up, the stroke is rasterised into a 48×48 grayscale tensor and classified by a TensorFlow.js CNN with three convolutional blocks (32/64/128 filters) and global average pooling.
3. A geometric corner-counting pass runs in parallel and can override the CNN result when the stroke's physical corner structure contradicts the prediction (e.g. a clearly three-cornered stroke that the CNN labelled as a rectangle).
4. The recognised shape is added to the canvas as a clean vector element. Rectangles and squares become custom UML class shapes; lines are routed as orthogonal A\* paths around other shapes.
5. All shape changes flow through a Yjs document. The y-websocket server broadcasts CRDT deltas to every other connected client in the same room.
6. Diagram snapshots are auto-saved to Supabase every five seconds.
7. When the user clicks **Generate Java**, the canvas is exported as a PNG and posted to the backend, which forwards it to Claude. The returned Java code is cleaned up and shown in a modal.

For a full technical write-up, see the dissertation in `backend/SW4_FYP_Dissertation_Final_v7.zip`.

---

## Author

**Hammad Mubarik** — B.Sc. (Hons) in Software Development, Atlantic Technological University, Galway.
