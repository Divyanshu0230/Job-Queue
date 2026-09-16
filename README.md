# Job Queue Dashboard

I built this for a React + NestJS intern assignment. It looks like a small operator dashboard. The real problem is: **who wins when two people (or two tabs) try to start the same job at the same time?**

The UI lets you create a job, start it, finish it, or mark it failed. The API is the source of truth. Status changes go through a finite state machine and a compare-and-swap write. React only shows the next legal buttons. curl can still hit the same rules.

**Stack:** TypeScript · React 18 · Vite · TanStack Query · NestJS 10 · TypeORM · SQLite locally · PostgreSQL in production.

**Repo:** [github.com/Divyanshu0230/Job-Queue](https://github.com/Divyanshu0230/Job-Queue)

How I would demo and defend this in a review: [docs/SUBMISSION.md](docs/SUBMISSION.md).

## Submit these

| Submission field | Link |
| --- | --- |
| GitHub repository link | https://github.com/Divyanshu0230/Job-Queue |
| Live frontend URL | https://job-queue-dashboard-rho.vercel.app |
| Live backend/API URL | https://job-queue-api.vercel.app |

Local:

- App: [http://127.0.0.1:5173](http://127.0.0.1:5173)
- API: [http://127.0.0.1:3000](http://127.0.0.1:3000)
- API docs: [http://127.0.0.1:3000/docs](http://127.0.0.1:3000/docs)

## Bonus (the production-shaped piece)

The brief says add **one** small thing that would help in production, and say why.

I picked **compare-and-swap on the job row** (`UPDATE ... WHERE id AND status AND version`). The assignment’s interesting question is two tabs claiming the same waiting job. A Redis lock or a worker pool would be bigger than this problem. A conditional SQL write is the smallest thing that stays correct when React is not the only client.

I also wired **SSE** (`GET /jobs/stream`) so the other tab updates without a refresh, and an append-only **`job_events`** table so you can answer “who flipped this job?”. Those sit on top of the same decision. If the stream drops, the UI polls every 4s.

## Screenshots

I kept the product language operator-facing. Home, Jobs, Activity, Settings. No intern writeup leaked into the UI (no CAS / SSE / audit-log jargon on screen).

### 1. Home

Counts, jobs that need a look, queue mix, latest activity.

![Home overview in day mode](docs/screenshots/01-home-overview.png)

### 2. Jobs

Filters, search, status counts, inline actions (start / complete / fail / clone / delete).

![Jobs queue table](docs/screenshots/02-jobs-queue.png)

### 3. Create a job

Title, type, priority, optional notes. New jobs always enter as waiting.

![Create job modal](docs/screenshots/06-new-job.png)

### 4. Job detail

Lifecycle on the left, timestamps + history on the right. Allowed actions follow the server machine, not a client guess.

![Job detail with status machine](docs/screenshots/03-job-detail.png)

### 5. Activity

Append-only trail of starts, finishes, and failures. Same data the API stores in `job_events`.

![Activity log](docs/screenshots/04-activity.png)

### 6. Settings

Day / night, table density, display name. Stays on this browser only.

![Settings](docs/screenshots/05-settings.png)

### 7. Night mode

Same layout, readable contrast. I checked tables, badges, and buttons in both themes.

![Home in night mode](docs/screenshots/07-dark-home.png)

![Queue in night mode](docs/screenshots/08-dark-queue.png)

---

## What I was asked to do vs what I shipped

The brief is CRUD jobs + a status machine + proof that two clients cannot both claim the same row.

| Checkpoint | Where it lives |
| --- | --- |
| Create / list / get / delete | `POST/GET/DELETE /jobs` |
| Status change | `PATCH /jobs/:id/status` |
| Validation | `class-validator` DTOs, 400 on bad input |
| Server-enforced transitions | `job-status.ts` + service, not React |
| Two-tab race | CAS `UPDATE ... WHERE id AND status AND version` → 409 |
| Dashboard | Home + Jobs + Activity |
| Live updates | SSE `/jobs/stream`, poll every 4s if the stream drops |
| Tests | unit + e2e, including `Promise.all` on two PATCHes |

Extras I added because a real operator console needs them, not because they look fancy: overview counts, clone, bulk start, priority/notes, watchlist, CSV export, day/night, keyboard shortcuts (`N`, `/`, `Esc`).

I would not call this a distributed queue. There is one database. The row is the lock. That is enough for this problem.

## High-level architecture

Two processes. The browser never writes the database. Nest is the only writer. SQLite on my laptop. The Vercel demo API uses `sql.js` so it can run as a serverless function (no native SQLite addon). Postgres is still supported via `DATABASE_URL` if this moved to a long-running host.

```mermaid
flowchart LR
  subgraph client ["Browser"]
    UI["React 18 + Vite<br/>TanStack Query"]
    SSE["EventSource"]
  end

  subgraph api ["NestJS 10"]
    HTTP["HTTP + ValidationPipe"]
    Jobs["JobsService"]
    Machine["Status machine"]
    CAS["CAS UPDATE"]
    Bus["RxJS Subject"]
  end

  subgraph data ["Database"]
    JobsT["jobs"]
    EventsT["job_events"]
  end

  UI -->|"REST /jobs*"| HTTP
  HTTP --> Jobs
  Jobs --> Machine
  Machine --> CAS
  CAS --> JobsT
  Jobs --> EventsT
  Jobs --> Bus
  Bus -->|"SSE /jobs/stream"| SSE
  SSE -->|"invalidate queries"| UI
```

**Why this split**

- React can lie. A hidden button is not a security boundary.
- The assignment asks what happens if someone bypasses the UI. Answer: they still hit DTO checks, the transition map, and the conditional UPDATE.
- SSE is a bonus for the two-tab prompt. If it dies, polling keeps the other tab honest.

### Containers

```mermaid
flowchart TB
  Op["Operator"] --> Web["Web app<br/>React · Vite · TanStack Query"]
  Web -->|"REST + SSE"| API["API<br/>NestJS · TypeORM"]
  API --> DB[("Database<br/>SQLite local / Postgres prod")]
```

Same boxes in production: Vercel serves the web app and the API. Locally the database is SQLite. On Vercel the demo API uses `sql.js` (data can reset on a cold start). A real host would use Postgres.

## Low-level design

### Request path for a status change

```mermaid
sequenceDiagram
  actor TabA
  actor TabB
  participant API as NestJS
  participant Tx as DB transaction
  participant Row as jobs row

  TabA->>API: PATCH /jobs/:id/status {status:running, expectedVersion:1}
  TabB->>API: PATCH /jobs/:id/status {status:running, expectedVersion:1}
  API->>Tx: BEGIN
  Tx->>Row: SELECT id
  Tx->>Tx: canTransition(pending, running)?
  Tx->>Row: UPDATE SET running, version=2<br/>WHERE id AND status=pending AND version=1
  alt affected = 1
    Tx->>Tx: INSERT job_events
    Tx-->>API: 200 job v2
    API-->>TabA: 200
    API-->>TabB: 409 STALE_STATUS
  end
```

Both tabs can read `pending`. Both can send `running`. Only one UPDATE matches. The loser gets a typed 409, not a generic 500.

### Compare-and-swap (the lock)

I did not add Redis. The lock is this write:

```sql
UPDATE jobs
SET status = 'running',
    version = version + 1,
    startedAt = now()
WHERE id = :id
  AND status = 'pending'
  AND version = :version;
```

- First commit: `affected = 1` → win, bump version, append `job_events`.
- Second commit: `affected = 0` → `STALE_STATUS`.
- Illegal graph move (example: `completed → running`) never reaches a successful write. That is `INVALID_TRANSITION`.
- If the UI already saw a newer version over SSE, it sends `expectedVersion` and can get `VERSION_CONFLICT` before it even tries the graph.

SQLite serializes writers. Postgres `READ COMMITTED` still makes a conditional UPDATE safe here, because the WHERE clause is the check.

### Live updates

```mermaid
flowchart TD
  Write["JobsService create / update / delete"] --> Pub["Subject.publish"]
  Pub --> SSE["GET /jobs/stream"]
  SSE --> ES["EventSource in the browser"]
  ES --> Inv["invalidate jobs, job, overview, activity"]
  SSE -.->|onerror| Poll["refetchInterval 4s"]
  Poll --> Inv
```

Heartbeat every 15s so proxies do not kill the stream. Throttling skips `/jobs/stream` so a live tab is not treated as abuse.

### Data model

```mermaid
erDiagram
  JOBS {
    uuid id PK
    string title
    string type
    string status
    string priority
    string notes
    int version
    datetime startedAt
    datetime finishedAt
    datetime createdAt
    datetime updatedAt
  }
  JOB_EVENTS {
    uuid id PK
    uuid jobId FK
    string fromStatus
    string toStatus
    datetime createdAt
  }
  JOBS ||--o{ JOB_EVENTS : "append-only history"
```

Indexes on `status`, `type`, `createdAt`. Events are cascade-deleted with the job because the brief allows hard `DELETE /jobs/:id`.

### Status machine

```
pending  →  running  →  completed
   \            ↘
    ↘            failed
     failed
```

| From | Allowed next | Meaning |
| --- | --- | --- |
| pending | running, failed | claim, or cancel before start |
| running | completed, failed | finish |
| completed | none | terminal |
| failed | none | terminal |

Clone exists for “run it again”: it inserts a **new** pending row. It does not revive a terminal job. That would break the graph.

Types: `email` · `report` · `ingest` · `webhook` · `cleanup`.

## API

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/jobs` | Create pending job |
| `GET` | `/jobs` | Filters: status, type, search, page, limit. Includes `stats` |
| `GET` | `/jobs/overview` | Home snapshot |
| `GET` | `/jobs/activity` | Recent events |
| `GET` | `/jobs/:id` | Job + ordered events |
| `PATCH` | `/jobs/:id/status` | Atomic transition |
| `PATCH` | `/jobs/:id` | Title / notes / priority |
| `POST` | `/jobs/:id/clone` | New pending copy |
| `POST` | `/jobs/bulk-start` | Start several waiting jobs, each through CAS |
| `DELETE` | `/jobs/:id` | 204 |
| `GET` | `/jobs/stream` | SSE |
| `GET` | `/` | API index (so the submitted backend URL is not a 404) |
| `GET` | `/health` | Process + DB |
| `GET` | `/docs` | API docs page |

SPA routes are `/`, `/queue`, `/queue/:id`, `/activity`, `/settings`. The REST path stays `/jobs` so Vite never confuses the UI with the API.

Conflict body (example):

```json
{
  "statusCode": 409,
  "code": "INVALID_TRANSITION",
  "message": "A completed job cannot move to running.",
  "currentStatus": "completed",
  "requestedStatus": "running",
  "allowedTransitions": [],
  "currentVersion": 3
}
```

## Frontend architecture

```mermaid
flowchart TB
  App["App / Shell"] --> Chrome["Sidebar + Topbar"]
  App --> Pages["Home / Queue / Detail / Activity / Settings"]
  Pages --> Hooks["useJobs, useOverview, useActivity"]
  Hooks --> TQ["TanStack Query cache"]
  App --> Stream["useJobStream"]
  Stream -->|"SSE or 4s poll"| TQ
  Hooks --> API["lib/api.ts"]
  API -->|"fetch + EventSource"| Nest["NestJS"]
```

- Query cache is the client store. I did not add Redux.
- Status buttons are derived from the same transition map the server uses, so the happy path is clean. The server still rejects cheats.
- Theme is `html[data-theme]` + `localStorage`. Both palettes keep text contrast.

## How I would defend the two-tab question

1. Open the same waiting job in two tabs.
2. Click Start in both, almost together.
3. One tab gets success. The other gets 409 and a toast to refresh.
4. Database has one `running` row and one `job_events` line for that claim.

Or from a terminal:

```bash
ID=<uuid>
curl -s -o /tmp/a.json -w "%{http_code}\n" -X PATCH http://localhost:3000/jobs/$ID/status \
  -H 'content-type: application/json' -d '{"status":"running","expectedVersion":1}' &
curl -s -o /tmp/b.json -w "%{http_code}\n" -X PATCH http://localhost:3000/jobs/$ID/status \
  -H 'content-type: application/json' -d '{"status":"running","expectedVersion":1}' &
wait
```

One `200`, one `409`. The e2e test does the same with `Promise.all`.

## Assumptions and trade-offs

- One region, one database. Matches the assignment. Not a lock service.
- Operators are humans (or curl). There is no background worker claiming jobs.
- Hard deletes are allowed because the spec has `DELETE /jobs/:id`.
- `synchronize: true` for the demo. Real production would use migrations.
- CORS is open unless `FRONTEND_ORIGIN` is set.
- I seed 12 demo jobs on an empty DB so the dashboard is not a blank intern template.
- The live Vercel API keeps the DB in `/tmp` (`sql.js`). Fine for a demo. A real deploy would use Postgres so data survives.

If I had more time: migrations + Postgres in CI, soft deletes, `Idempotency-Key` on create, auth, a real worker pool + outbox, shared types package, Playwright for the UI race.

## Local run

Node 18+.

```bash
git clone https://github.com/Divyanshu0230/Job-Queue.git
cd Job-Queue
npm run install:all
npm run dev
```

SQLite file: `backend/data/queue.sqlite`. No Docker required.

Optional Postgres:

```bash
docker compose up -d
cd backend
DATABASE_URL=postgres://dispatch:dispatch@localhost:5432/dispatch npm run start:dev
```

## Tests

```bash
npm test          # state machine + CAS failure paths
npm run test:e2e  # validation, lifecycle, concurrent PATCH
```

9 unit tests, 5 e2e tests. The one I care about in an interview is: two concurrent `pending → running` writes, only one winner.

## Deploy

**Frontend (Vercel)**  
Root directory `frontend`. Output `dist`. Env:

```
VITE_API_URL=https://<api-host>
```

**Backend (Render / any Node host)**  
Root directory `backend`. Build `npm ci && npm run build`. Start `npm run start:prod`. Postgres `DATABASE_URL`. SQLite on a free dyno gets wiped on every deploy, so do not use it in production.

```
NODE_ENV=production
DATABASE_URL=postgres://...
DATABASE_SSL=true
FRONTEND_ORIGIN=https://<vercel-app>
TYPEORM_SYNC=true
PORT=3000
```

`render.yaml` is in the repo if you want a one-shot API + Postgres.

## Layout

```
backend/     NestJS API, TypeORM, unit + e2e tests
frontend/    React dashboard
docs/        screenshots used in this README
```

## Keyboard

- `N` new job
- `/` focus search
- `Esc` close drawers and modals
- `?` shortcuts
