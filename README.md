# FloodSense

Warn people hours before the flood. Street-level flood risk for Central Delhi that couples
the rain forecast, how low-lying each road is, and which drains are blocked right now.

Built for Environmental Hacks (WeMakeDevs x AWS, Bharat Builds Event 02), Heat and Water track.
Full plan: [docs/FloodSense_Plan.pdf](docs/FloodSense_Plan.pdf)

## Who it is for

- **Commuters**: a map of red, amber and green roads for the next 0 to 6 hours, with a reason
  and an alternative route, plus an SMS alert.
- **Citizens**: photo report of a blocked drain or waterlogged road, verified by AI.
- **Drain engineers**: a ranked cleaning list showing which drain to clear first and what it changes.

## Repo layout

| Path | What lives there |
|---|---|
| `backend/` | Python 3.12. Strands agent, scoring engine, API (Lambda / AgentCore) |
| `frontend/` | Next.js + Tailwind + MapLibre, hosted on Amplify |
| `data/` | Area boundary, roads, drains, clipped elevation. `raw/` is git-ignored |
| `infra/` | AWS setup (DynamoDB, S3, SNS, EventBridge, IAM) |
| `docs/` | Plan, architecture diagram, writeup |

## Run locally

Backend (needs [uv](https://docs.astral.sh/uv/)):

```bash
cd backend
cp ../.env.example .env   # fill in values
uv sync
uv run uvicorn floodsense.api:app --reload
```

Frontend (Node 20+):

```bash
cd frontend
npm install
npm run dev
```

## Data sources

- Rain: [Open-Meteo](https://open-meteo.com/) hourly forecast and historical archive
- Elevation: [Copernicus DEM GLO-30](https://registry.opendata.aws/copernicus-dem/) from the Registry of Open Data on AWS
- Roads and drains: OpenStreetMap contributors, pulled once via Overpass
- Blocked drains: citizen photo reports verified by Amazon Bedrock

## AI tools used

Claude Code was used for planning and scaffolding, as required to be declared by the rules.
