# Travel Planner PWA

A mobile-first, offline-first personal travel planner. It works for any trip: nothing in the code is tied to one destination.

## What it does

- **Trips.** Create a trip with cities, dates, travelers, travel style and must-dos. Everything can be edited later: the title, dates and status on *Edit trip*, and the cities, travelers and style on *Edit trip details*.
- **Itinerary.** One card per day. Each city gets a date range in one go (*Set city dates*). Activities are kept in clock order, with optional transport between them, a load indicator and overlap warnings.
- **Today.** The live day: what's up next by the clock, a "leave by" time, directions and quick Start / Complete / Skip.
- **Places, bookings, packing, travel legs, trip info.** A places library you can schedule from; bookings with deadlines and costs; a packing checklist with quantities; flights and trains between cities; an offline reference binder.
- **Readiness.** Plain checks with a link to each fix: dates, empty days, city assignments, overlaps, bookings, packing, the travel route (getting there, each move between cities, getting home) and trip info.
- **Backup.** Export a JSON backup and restore it, either replacing everything or merging (the newer copy of each record wins). Includes an integrity check.
- **Offline.** Installable PWA. Data lives in the browser's IndexedDB on the device; there is no account or server.

## What's new in 0.14

- **Date changes never move or hide plans by accident.** Days are matched by calendar date. When the whole trip moves, plans can move with it. When the trip gets shorter, activities on removed days move to the nearest remaining day. *Edit trip* shows exactly what will happen before you save. Clearing the dates is only possible when no activities are planned.
- **Activities left behind by earlier versions** (on days removed by a date change) are listed on the Itinerary with their old date so you can give them a day again.
- **Clock order.** New, edited and moved activities are placed by start time. Today picks "up next" by the clock. Days planned before this version get a *Sort by time* button.
- **Travel route readiness.** Instead of counting legs, the check looks for getting there, each move between consecutive cities, and getting home. A new leg that names a trip city ("Paris Gare du Nord") is linked to it automatically.
- **Leg times.** Date-times are checked strictly. Arrival may be earlier than departure in local time (flying east across the date line), but not by more than a day.
- **Merge restore keeps the newer copy**, so recent edits and deletions on this device are not undone. Backup records are checked for their bookkeeping fields before anything is written.
- **Edit trip details** after creating a trip: add, rename, reorder or remove cities; travelers; travel style; requirements. Time zones are checked (e.g. `Europe/Berlin`).
- **Set city dates**: assign each city to a date range instead of 18 days one by one.
- **Updates wait for you.** A new version shows a *Reload* banner instead of reloading mid-edit.
- Forms with date-and-time fields no longer overflow on 320 px phones. The version label comes from `package.json`.

## Requirements

- Node.js 22.12+
- npm

## Run locally

```bash
npm ci
npm run dev
```

## Tests

```bash
npm test
```

Runs the service tests in `tests/` (date changes, activity order, readiness, travel legs, backup merge, trip details, city dates) against an in-memory IndexedDB.

## Production build

```bash
npm run build
npm run preview
```

## GitHub Pages

`.github/workflows/deploy-pages.yml` builds and deploys on every push to `main`, setting Vite's base path from the repository name (`/travel-planner/`). In the repository settings, **Pages → Source** must be **GitHub Actions**.

After an update is deployed, the app shows a *Reload* banner the next time it's open. The first update to 0.14 arrives after the app is fully closed and reopened once, because older versions didn't have the banner.

## Routing

`HashRouter` keeps deep links working on static hosting, e.g. `/#/trip/:tripId/itinerary`.

## Data

`TravelPlannerDB` (IndexedDB via Dexie) holds trips, cities, days, places, activities, transport, travel legs, stays, bookings, packing and trip info. Every record has a UUID, `created_at`, `updated_at`, `deleted_at` (soft delete) and `revision`.

## Next steps

- Hotels with check-in and check-out, shown in Today along with flights.
- Attachments (tickets, boarding passes), map links for addresses and bookings, copy buttons for confirmation numbers, cost totals.
- Time zones per city, used for flight times and Today.
- Accessibility polish (contrast of small labels, larger tap targets), dark mode, a warning before leaving unsaved forms.
- A database upgrade path, so future schema changes keep old backups restorable.
