# Travel Planner PWA

A mobile-first, offline-first personal travel planning PWA. The project is intentionally generic: it is designed to support any future trip rather than encode one destination or itinerary.

## Current milestone

**Milestone 1 — Application Foundation (`v0.1`)**

Implemented:

- React + TypeScript + Vite project structure
- Hash-based client routing for static hosting
- Responsive phone/iPad application shell
- Phone bottom navigation and tablet/desktop sidebar
- Routes for Trips, Trip Dashboard, Itinerary, Today, and More
- PWA manifest and service-worker configuration
- Home Screen icons and standalone display mode
- GitHub Pages deployment workflow
- Dynamic GitHub Pages base path
- Placeholder screens designed to evolve into later milestones

Not implemented yet:

- IndexedDB / Dexie persistence (Milestone 2)
- Trip creation and management (Milestone 3)
- Day-by-day itinerary CRUD (Milestone 4)

## Requirements

- Node.js 22.12+ recommended
- npm

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Production build

```bash
npm run build
npm run preview
```

## GitHub Pages

The included `.github/workflows/deploy-pages.yml` builds and deploys on every push to `main`. The first local `npm install` will also generate `package-lock.json`; once that lockfile is committed, the workflow can optionally be tightened from `npm install` to `npm ci`.

After pushing the project to a GitHub repository:

1. Open the repository on GitHub.
2. Go to **Settings → Pages**.
3. Set **Source** to **GitHub Actions** if it is not already selected.
4. Push to `main` or run the workflow manually.

The workflow automatically sets Vite's base path from the repository name, so a repository such as `travel-planner` is deployed correctly under `/travel-planner/`.

## Routing

The project uses `HashRouter`, giving routes such as:

```text
/#/trips
/#/trip/:tripId
/#/trip/:tripId/itinerary
/#/trip/:tripId/today
/#/trip/:tripId/more
```

This avoids deep-link refresh problems on static GitHub Pages hosting.

## Project direction

Planned milestones:

1. Foundation
2. IndexedDB / Dexie database
3. Trip management
4. Itinerary management
5. Places
6. Transportation
7. Bookings
8. Packing
9. Today Mode
10. Trip Readiness
11. Backup & resilience
12. V1 polish

The data architecture will remain local-first so future cloud sync can be added without making the app unusable offline.
