# Debug and Cheapest Hosting Plan

## Goal

Stabilize the current system, remove deployment blockers, and host it with the lowest practical monthly cost while keeping it maintainable.

## Current System Snapshot

- Backend: Django REST API in `backend/`
- Web frontend: React + Vite in `frontend_web/`
- Mobile app: Expo / React Native in `mobile/`
- Database: SQLite by default, PostgreSQL optional
- Known issue source: `bugs_report.txt`

## What I Found So Far

### Existing functional issues already identified

1. Vendor score recalculation is stale after flagged-review deletion.
2. Admin vendor suspend/unsuspend uses the wrong identifier from the web UI.
3. Vendor profile ownership check uses the wrong field.
4. Anonymous ratings disappear from the consumer history view.
5. Rating config PATCH behaves like a full update.
6. Frontend lint currently fails because of an unused variable.

### Deployment blockers I found in code

1. Web frontend API base URL is hardcoded to `http://localhost:8000/api/v1`.
2. Mobile app falls back to localhost / emulator-only addresses.
3. `mobile/app.json` still points to localhost.
4. Backend currently allows all CORS origins, which is not appropriate for production.
5. Backend is defaulting to SQLite, which is acceptable for very low traffic on a VPS but not for most managed/serverless setups.

### Repo state note

- The worktree already has user changes in:
  - `backend/config/settings.py`
  - `backend/core/views.py`
- I will avoid overwriting unrelated edits while debugging.

## Execution Plan

### Phase 1: Reproduce and verify

1. Set up the backend environment and run Django checks.
2. Install frontend dependencies and run:
   - `npm run build`
   - `npm run lint`
3. Run targeted API and UI checks for the six known bugs.
4. Confirm whether there are additional runtime errors beyond `bugs_report.txt`.

## Phase 2: Fix the application bugs

1. Fix vendor aggregate recalculation after rating deletion.
2. Fix admin suspend/unsuspend so frontend and backend use the same identifier consistently.
3. Fix vendor ownership detection on the public vendor profile page.
4. Preserve ownership of anonymous ratings while still hiding public identity.
5. Make rating-config PATCH truly partial.
6. Fix frontend lint errors and any other small build-time blockers.

## Phase 3: Make the app deployable

1. Replace hardcoded API URLs with environment-based configuration in:
   - `frontend_web/src/api/client.js`
   - `mobile/src/api/client.js`
   - `mobile/app.json`
2. Add production environment examples for backend and frontend.
3. Tighten backend production settings:
   - explicit `ALLOWED_HOSTS`
   - explicit CORS origin allowlist
   - secure cookie / HTTPS behavior
4. Validate static/media handling for production.
5. Add a clear deployment README or section describing exact commands.

## Cheapest Hosting Recommendation

### Recommended lowest-cost production path

- Web frontend: Cloudflare Pages free tier
- Backend API: one small VPS
- Reverse proxy: Nginx on the VPS
- Process manager: `systemd`
- TLS: Let's Encrypt
- Database:
  - cheapest initial option: SQLite on the same VPS for very light traffic
  - safer upgrade path: PostgreSQL on the same VPS once usage grows

### Why this is the cheapest practical setup

1. Static React hosting can be free.
2. A single small VPS is usually cheaper than separate managed API + managed database services.
3. Keeping database and API on one box avoids an extra monthly database bill.
4. This stack fits the current Django architecture better than trying to force SQLite onto serverless platforms.

### Recommended budget target

- VPS: roughly $4 to $7 per month depending on provider and region
- Domain: roughly $10 to $15 per year if needed
- SSL: free with Let's Encrypt
- Web hosting: free on Cloudflare Pages

## Hosting Options Compared

### Option A: Cheapest overall

- Cloudflare Pages for `frontend_web`
- Small VPS for Django + SQLite
- Best when traffic is low and budget is the top priority

### Option B: Better reliability for still-low cost

- Cloudflare Pages for `frontend_web`
- Small VPS for Django + PostgreSQL
- Slightly more setup, but better concurrency and safer long term

### Option C: Simplest managed deployment

- Static frontend on Vercel / Netlify / Cloudflare Pages
- Backend on Railway / Render / Fly.io
- Managed PostgreSQL
- Easiest operationally, but usually costs more than a single VPS

## Recommended Order of Delivery

1. Finish debugging first.
2. Convert all clients to environment-based API configuration.
3. Deploy backend on a cheap VPS.
4. Deploy web frontend to Cloudflare Pages.
5. Point frontend environment to the live API.
6. Update mobile app config to use the live API for builds.
7. Smoke test auth, ratings, admin actions, media, and vendor profile flows in production.

## Deliverables I Will Produce

1. Bug fixes in backend and frontend code.
2. Environment-based API configuration for web and mobile.
3. Production-safe backend configuration.
4. Deployment instructions.
5. A recommended cheapest hosting architecture and rollout path.

## Acceptance Criteria

- Backend checks run successfully.
- Web frontend builds and lints cleanly.
- The six identified bugs are fixed and verified.
- Web app works against a non-local API URL.
- Mobile app can be configured against a non-local API URL.
- Production settings no longer depend on localhost or wildcard CORS.
- The app can be deployed with a monthly cost near the minimum practical range.

## Immediate Next Step

I will start with Phase 1: reproduce the issues locally, verify which of the six bugs are still present, and then fix them in the smallest safe set of changes before preparing deployment configuration.
