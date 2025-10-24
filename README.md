# SS13 Barmen UI

A lightweight Express + static front-end companion for tracking and searching the Space Station 13 bartender recipes maintained by BlueMoon Station patrons. The service keeps a cached snapshot of drink recipes, reagents, and ingredient availability, layers helpful metadata on top (icons, sources, strengths), and provides a responsive UI tailored for both bartenders in-game and recipe tinkerers.

## Highlights
- End-to-end recipe browser with ingredient, alcohol content, and source toggles
- Server-side cache keeps GitHub traffic low while presenting fresh data every 15 minutes
- Developer view reveals raw paths, dependencies, and other data useful for modders
- Drink icon extraction pipeline converts DMI sprite sheets into web-friendly GIFs
- JSON API (`/api/recipes`, `/api/ingredients`, `/api/reagents`) for custom tooling and automation

## Architecture Overview
- **Backend** (`src/`): Express application that pulls raw `.dm` source files from the BlueMoon-Labs repositories, normalizes everything into a single dataset, and exposes read-only API endpoints.
- **Dataset builders** (`src/data/`): Parsers, normalizers, and index builders that interpret DM files, resolve dependencies, and attach icons plus supply/vendor availability.
- **Frontend** (`public/`): Static assets served by Express. The UI fetches JSON from the API, applies client-side filtering/sorting, and stores user preferences in `localStorage`.
- **Icon pipeline** (`scripts/extract-drink-icons.mjs`): Downloads upstream DMI sprite sheets, slices frames into GIFs, and writes an attribution-aware manifest consumed at runtime.

## Prerequisites
- Node.js 20 LTS or newer (the Docker image uses `node:22-alpine`)
- npm 10+
- GitHub personal access token (optional but recommended to prevent rate-limit errors)

## Local Setup
1. Install dependencies:
   ```bash
   npm ci
   ```
2. Fetch drink icons (required after a clean clone or when upstream sprites change):
   ```bash
   npm run extract:drinks
   ```
3. Configure environment variables (see [Environment](#environment) below). For example, create a minimal `.env` file:
   ```bash
   echo "GITHUB_TOKEN=ghp_yourTokenHere" >> .env
   ```
4. Start the server:
   ```bash
   npm start
   ```
5. Visit `http://localhost:3000` (or your chosen `PORT`).

> **Windows tip:** `npm run dev` uses a Unix-style inline `NODE_ENV=development` assignment. If you need the development mode on Windows, prefer `set NODE_ENV=development` (PowerShell: `$Env:NODE_ENV = "development"`) before running `node src/server.js`.

## npm Scripts
| Script | Description |
|--------|-------------|
| `npm start` | Launches the Express server in production mode. |
| `npm run dev` | Runs `src/server.js` with `NODE_ENV=development` (useful for verbose logging). |
| `npm run extract:drinks` | Rebuilds the drink icon manifest and GIF assets from upstream DMI files. |

## Environment
| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `3000` | HTTP port for the Express server. The Dockerfile defaults to `24322`. |
| `NODE_ENV` | `production` | Controls Express/compression and runtime logging. |
| `GITHUB_TOKEN` | _unset_ | Personal access token used when contacting the GitHub API. Without it, requests are limited to 60/hour; with it, the app inherits your token's quota. |

## Dataset Lifecycle
- The dataset loader fetches raw `.dm` files from URLs defined in `src/data/githubSources.js`.
- Responses are cached in-memory for 15 minutes (`CACHE_TTL_MS`). Subsequent API calls hit the cache instead of re-querying GitHub.
- A preload runs during server start; if it fails, the process exits with a non-zero status.
- The dataset includes linked recipes (`requiredRecipes`, `dependentRecipes`), ingredient metadata, icon references, and availability derived from dispensers, vendors, and supply packs.

To force a clean refresh (for example, in a REPL or future admin endpoint), use `clearRecipeDatasetCache()` from `src/data/loadData.js` before calling `getRecipeDataset()` again.

## HTTP API
All routes respond with JSON and live under `/api`.

### `GET /api/recipes`
- **Query parameters**
  - `search` — Match recipe names or ingredient display names (case-insensitive substring).
  - `ingredient` — Filter recipes that require a specific reagent path.
  - `alcoholic` — `true` or `false` to enforce alcohol content.
  - `source` — Single value or comma-separated list of source labels (matches server-side normalization).
- **Response**
  ```json
  {
    "fetchedAt": "2024-07-01T20:18:10.123Z",
    "total": 512,
    "count": 24,
    "recipes": [ /* normalized recipe objects */ ]
  }
  ```

### `GET /api/ingredients`
Returns ingredient list with usage counts, booze power, and sourcing data.

### `GET /api/reagents`
Returns the normalized reagent catalog, including attribution for icons where available.

## Front-End Features
- Quick filters for alcohol content, ingredients, and sort order.
- Source toggles to include/exclude recipe packs (Core Station, Modular Splurt, etc.).
- Ingredient availability chips grouped by dispenser/vendor/supply categories with search and "show all" controls.
- Developer view exposing raw paths, IDs, and recipe relationships.
- Local state persisted to `localStorage` for view mode and filter choices.

## Docker & Container Usage
Build the image locally:
```bash
docker build -t ss13-barmen-ui .
```
Run the container:
```bash
docker run --rm -p 24322:24322 -e PORT=24322 -e GITHUB_TOKEN=yourToken ss13-barmen-ui
```

A sample `docker-compose.yml` is included for deploying the prebuilt `dullfox/ss13-bar-helper:latest` image onto an external `wikinet` network. Adjust the `env_file`, port mapping, and network name to match your environment.

## Updating Drink Icons
`npm run extract:drinks` re-downloads the upstream DMI sprite sheets, slices them into GIFs, and rewrites `public/assets/drinks/manifest.json`. Run it whenever upstream art changes or when first cloning the repository. Generated assets include attribution metadata (`sourceRepository`, `license`, `attribution`) which are surfaced alongside recipe icons in developer mode.

## Data Sources & Attribution
- All recipe, reagent, dispenser, and supply pack definitions originate from the [BlueMoon-Labs/BlueMoon-Station](https://github.com/BlueMoon-Labs/BlueMoon-Station) repository. Respect their licensing and contribution guidelines.
- Drink sprites are © BlueMoon-Labs/BlueMoon-Station and licensed under CC-BY-SA 3.0, as preserved in the generated icon manifest. The extraction script stores attribution and license details for downstream use.
- When redistributing data or assets, retain these credits and comply with upstream licenses.

## Contributing
Issues and pull requests are welcome. Please include reproduction steps or sample data when reporting parsing errors, and run `npm run extract:drinks` before submitting icon-related changes.

## License
Source code is provided under the terms of the [MIT License](./LICENSE). Drink sprites and other assets sourced from the BlueMoon Station project remain © their original authors and continue to be licensed under CC-BY-SA 3.0 as recorded in the generated icon manifest. Retain upstream attribution when redistributing those assets.
