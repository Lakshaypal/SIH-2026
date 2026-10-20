# Halocline / OceanEmbed-PG — SIH 2026

An ocean-data research prototype and maritime dashboard for SIH 2026 problem SIH26066. The repository combines a surface-to-depth ocean-profile learning pipeline with a web visualisation and AIS vessel-monitoring experiments.

## Components

- **Dashboard:** vanilla HTML/CSS/JavaScript views, maps and maritime displays (`index.html`, `dashboard.html`, `frontend.js`).
- **Local server:** Node.js HTTP/SSE server, optional AISStream connection, receiver history and a clearly labelled demo fleet (`local-server.mjs`).
- **Serverless adapters:** Vercel functions in `api/`; their behaviour differs from the persistent local server.
- **Research pipeline:** PyTorch surface encoder and depth-conditioned field, patch datasets, masked probabilistic losses, training, baselines and exports (`src/`).
- **Development data:** a synthetic-data generator and processed sample data. Synthetic demonstrations are not evidence of performance on real ocean observations.

## Run the dashboard

Use Node.js 24 and npm:

```sh
git clone https://github.com/Lakshaypal/SIH-2026.git
cd SIH-2026
npm ci
```

Copy the existing example to a local, ignored environment file:

```sh
cp .env.example .env
```

Set your own values (never commit populated credentials):

```dotenv
AISSTREAM_API_KEY=
CARTO_API_KEY=
PORT=4173
```

`.env` is intentionally excluded from tracked source. Keep real keys private.

```sh
npm run dev
```

Open `http://localhost:4173` (or your configured port). The local server maintains 96 labelled demo vessels. Live AIS needs your own AISStream key and a connection to `/api/ais/stream`; the presence of the dashboard alone does not establish a live feed. Tracks are held in process memory and disappear on restart.

```sh
npm test
```

The npm test command checks JavaScript syntax; it is not a full behaviour or model-quality test suite.

## Research pipeline

Use Python 3.10+ with a compatible PyTorch build:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m src.data.make_fake_data --help
python -m src.train --help
python -m src.baselines.run_baselines --help
python -m src.export --help
```

Inspect the command options and data requirements before starting a run. The dataset layer expects compatible surface, profile and climatology Zarr stores; training uses time-based splits. Obtain and validate real source datasets separately before making scientific accuracy claims.

## Local and hosted modes

The local server maintains a long-lived AIS/SSE session and track history. Vercel handlers are short-lived: the SSE adapter sends a demo snapshot, history is empty, and the vessel adapter collects a brief live sample if configured. A serverless deployment is not equivalent to the persistent local server.

## Structure

```text
api/                Serverless maritime endpoints
src/data/           Synthetic development data
src/datasets/       Patch/profile dataset loading
src/models/         Surface encoder and depth field
src/losses/         CRPS and physical/regularisation losses
src/baselines/      Reference models and comparison runner
src/eval/           Profile metrics
src/train.py        Training entry point
src/export.py       Export entry point
local-server.mjs    Local dashboard and AIS bridge
```

Repository design notes describe broader planned capabilities. The code and evaluation artefacts should be used to distinguish implemented work from proposed extensions.
