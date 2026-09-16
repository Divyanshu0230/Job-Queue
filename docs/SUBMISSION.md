# Submission notes

I am submitting a React + NestJS job queue dashboard.

Repo: https://github.com/Divyanshu0230/Job-Queue

Live dashboard: _Vercel URL after deploy_

Live API: _API URL after deploy_

I wrote this so I can defend the project in a short call. The UI is small on purpose. The part I want to talk about is the status machine and the race.

## What the product is

You create a job (email, report, ingest, webhook, cleanup). It starts as waiting. Someone starts it. Then it is finished or failed. Home shows counts and things that need a look. Jobs is the table. Activity is the history. Settings is day/night and density.

I did not put engineering secrets in the UI. No “CAS”, no “SSE”, no “audit log” labels. An operator should not have to know those words. I kept them in this repo’s README because a reviewer needs them.

## How I would walk through it

1. Open Home. Counts should match the table.
2. Open Jobs. Filter by Waiting, start one job.
3. Open the same job in another tab. Try to start it again. One tab wins, the other gets a conflict.
4. Open Activity. The start should be in the log.
5. Switch to night mode. Table, badges, and buttons should still be readable.
6. Create a job from `N`. It should land as waiting.

If the live stream drops, the UI polls every 4 seconds. You should still see the other tab’s change.

## Where the assignment rules actually live

The brief says: do not trust the client.

- DTOs + ValidationPipe: bad title / type → 400
- `ALLOWED_TRANSITIONS` in `backend/src/jobs/job-status.ts`: illegal move → 409 `INVALID_TRANSITION`
- `UPDATE ... WHERE id AND status AND version` in `JobsService.updateStatus`: lost race → 409 `STALE_STATUS`
- UI buttons are a convenience. I can still reproduce every check with curl.

I would say this out loud: “React hides the wrong button. Nest refuses the wrong write. The database refuses the late write.”

## Why I did not use Redis / a lock service

The assignment is one database. A compare-and-swap on the row is the lock. Redis would be a second source of truth I do not need here. If this became many regions or many worker processes, then I would talk about leases and an outbox. That is not this project.

## Tests I would point to

```bash
npm test
npm run test:e2e
```

The e2e file fires two `pending → running` PATCHes with `Promise.all`. Expect one 200 and one 409. That is the demo.

## Deploy

Frontend is meant for Vercel (`frontend/`, env `VITE_API_URL`).

API needs a Node host + Postgres. SQLite on a free web dyno gets wiped. `render.yaml` is there if we use Render for the API.

## What I would do next if this was a real team

- Migrations, not `synchronize`
- Auth
- Soft delete so history survives
- Idempotency key on create
- Playwright for the two-tab UI, not only the API race

I stopped before that so the core stays reviewable in one sitting.
