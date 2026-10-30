# BrightBank

Small banking demo (frontend + Node API + MySQL) packaged for a reproducible local/VM deploy with Docker Compose and a GitHub Actions pipeline that tests, scans, builds, and pushes versioned images.

**Repo:** https://github.com/abmaxxx/brightbank  
**Images:** `abmaxx/brightbank-backend`, `abmaxx/brightbank-frontend` (Docker Hub)

---

## What this project demonstrates

1. Docker images with health/readiness endpoints and **non-root** containers  
2. CI that installs deps, lints, runs tests, scans, builds images, and **blocks push when checks fail**  
3. Local/VM deploy with Docker Compose (app + MySQL + env config + persistent volume)  
4. Safe release/rollback using **commit-SHA tagged** images  
5. Observability: structured JSON logs, `/api/health`, `/api/ready`, failure investigation  
6. Secrets hygiene, least privilege, dependency/image scanning, cost-aware cloud notes  

---

## Architecture

```
Developer push → GitHub Actions
                    ├─ test (lint + 6 Jest tests)
                    ├─ security (npm audit + Trivy fs)
                    └─ build-and-push (build → Trivy image scan → push)
                                      ↓
                                 Docker Hub
                                      ↓
                         VM: docker compose pull/up
                    ┌─────────────┬──────────────┬────────────┐
                    │  frontend   │   backend    │   mysql    │
                    │  :8080      │   :5000      │   volume   │
                    │  (nginx)    │   (node)     │   (healthy)│
                    └─────────────┴──────────────┴────────────┘
```

Full diagrams: [`docs/architecture.png`](docs/architecture.png) · [`docs/architecture.md`](docs/architecture.md) · [`docs/architecture.svg`](docs/architecture.svg)

---

## Prerequisites

- Docker and Docker Compose v2  
- A Docker Hub account (for pull), **or** use public images already published under `abmaxx`  
- Git  

Optional (backend tests only): Node.js 20+

---

## Quick start (fresh clone)

```bash
git clone https://github.com/abmaxxx/brightbank.git
cd brightbank
```

### 1. Environment files

Copy the examples (do **not** commit real secrets):

```bash
cp .env.example .env
cp backend/.env.example backend/.env   # if present; otherwise compose/root .env covers runtime
```

Edit root `.env`:

```env
DOCKERHUB_USER=abmaxx
TAG=<7-char-commit-tag-from-Docker-Hub>
```

Use a tag that **exists** on Docker Hub for both `brightbank-backend` and `brightbank-frontend` (same tag).

Also set DB values used by Compose (synthetic practice values only), for example:

```env
MYSQL_ROOT_PASSWORD=changeme_root
MYSQL_DATABASE=brightbank
MYSQL_USER=brightbank
MYSQL_PASSWORD=changeme_app
```

Match whatever your `compose.yml` expects (`DB_*` / `MYSQL_*`). Prefer `changeme` placeholders in examples; never commit real tokens.

### 2. Start the stack

```bash
docker compose pull
docker compose up -d
docker compose ps
```

Expect three containers: `brightbank-frontend`, `brightbank-backend`, `brightbank-mysql` (mysql **healthy**).

### 3. Verify

```bash
docker exec brightbank-backend whoami      # node
docker exec brightbank-frontend whoami     # nginx
docker exec brightbank-backend ls -a /app  # .env must NOT appear in the image
curl http://localhost:5000/api/health     # {"status":"alive"}
curl http://localhost:5000/api/ready      # {"status":"ready","database":"connected"}
```

Open the UI:

```text
http://<HOST_IP>:8080
```

Try one deposit and one withdrawal.

### 4. Stop

```bash
docker compose down
```

Data in the MySQL volume is kept unless you remove the volume explicitly.

---

## Ports

| Service  | Port | Notes                          |
|----------|------|--------------------------------|
| Frontend | 8080 | Host `8080` → container `8080` |
| Backend  | 5000 | Health `/api/health`, ready `/api/ready` |
| MySQL    | 3306 | Internal Compose network       |

---

## Health vs readiness

| Endpoint        | Meaning                                      |
|-----------------|----------------------------------------------|
| `GET /api/health` | Process is up (liveness)                   |
| `GET /api/ready`  | DB reachable → 200; else 503 `not_ready`   |

Use this split when investigating: health alive + ready 503 ≈ database problem, not app crash.

---

## Run tests and lint (local)

```bash
cd backend
npm ci
npm run lint
npm test
```

Expected: **6 passed** Jest tests (DB mocked with Jest; MySQL not required for unit tests).

---

## CI/CD pipeline

Workflow: `.github/workflows/ci.yml`

| Job              | What it does                                      |
|------------------|---------------------------------------------------|
| `test`           | `npm ci`, lint, Jest (6 tests)                    |
| `security`       | `npm audit`, Trivy filesystem scan                |
| `build-and-push` | Build images → Trivy image scan → push to Hub   |

- `build-and-push` has `needs: [test, security]` → failed checks **block** image push  
- Images tagged with first **7 characters** of `GITHUB_SHA`  
- Secrets required: `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` (repo Settings → Secrets → Actions)

### Intentional failure (deployment block demo)

A temporary broken expectation on `/api/health` (`alive` → `dead`) produced a **red** `test` job and **skipped** `build-and-push`. After fix, pipeline went green again. Evidence: `evidence/05-ci-intentional-fail.png`, `evidence/06-intentionally-ci-fail-log.png`.

---

## Release and rollback

### Deploy a specific tag

```bash
cd ~/brightbank   # or your clone
# set TAG in .env to the desired 7-char tag
docker compose pull
docker compose up -d
```

### Rollback example

```bash
# was on newer tag (e.g. a710df8 / footer v2)
sed -i 's/^TAG=.*/TAG=728bf68/' .env   # Linux/VM
docker compose pull
docker compose up -d
```

Confirm UI footer / image tags match the older release. Evidence: `evidence/10-*.png`, `evidence/11-*.png`, `evidence/13-rollback-evidence.PNG`.

---

## Failure investigation (MySQL down)

```bash
curl http://localhost:5000/api/health
curl http://localhost:5000/api/ready

docker stop brightbank-mysql
curl http://localhost:5000/api/health          # still alive
curl -i http://localhost:5000/api/ready        # 503 not_ready

docker logs --tail 20 brightbank-backend       # structured JSON error
docker start brightbank-mysql
# wait until healthy
curl http://localhost:5000/api/ready           # 200 connected
```

Evidence: `evidence/12-mysql-db-down.png` (or similarly named file).

---

## Security notes (short)

- **Secrets:** `.env` gitignored; Docker Hub credentials only in GitHub Actions secrets; `.dockerignore` keeps `.env` / `node_modules` out of images  
- **Least privilege:** containers run as `node` / `nginx` (non-root); DB app user (not root for app); token scoped for push only as needed  
- **Scanning:** `npm audit`, Trivy fs + image scans; HIGH/CRITICAL can fail the job  
- **Cost-aware path:** one small VM + Compose first; managed DB and container service later if traffic grows  

More detail: `docs/decision-memo.md`, `docs/runbook.md`.

---

## Project layout

```text
brightbank/
├── backend/                 # API, tests, Dockerfile
├── frontend/                # static UI, Dockerfile
├── .github/workflows/ci.yml
├── compose.yml
├── .env.example
├── .gitignore
├── README.md
├── docs/
│   ├── runbook.md
│   ├── decision-memo.md
│   ├── ai-disclosure.md
│   └── architecture.png
└── evidence/                # screenshots / logs for submission
```

---

## Evidence index

| File | Shows |
|------|--------|
| `evidence/01-tests-npm.png` | 6/6 local tests |
| `evidence/02-lint.png` | Lint run |
| `evidence/03-ci-success.png` | Green CI |
| `evidence/04-ci-security.png` | Security job green |
| `evidence/05-ci-intentional-fail.png` | Intentional red CI |
| `evidence/06-intentionally-ci-fail-log.png` | Failed test log |
| `evidence/07-dockerhub-frontend.png` | Frontend tags |
| `evidence/08-dockerhub-backend.png` | Backend tags |
| `evidence/09-deploy-compose.png` | Compose deploy |
| `evidence/10-upgraded-to-new-version.png` | v2 UI |
| `evidence/11-rollback-to-old-version.png` | Rolled-back UI |
| `evidence/12-mysql-db-down.png` | Incident investigation |
| `evidence/13-rollback-evidence.PNG` | TAG switch + compose |

---

## Related docs

- [Architecture](docs/architecture.md) — runtime + CI process diagrams ([SVG](docs/architecture.svg))  
- [Runbook](docs/runbook.md) — deploy, rollback, incident, troubleshooting  
- [Decision memo](docs/decision-memo.md) — assumptions and trade-offs  
- [AI disclosure](docs/ai-disclosure.md) — AI assistance used  

---

## Assumptions

- Demo data only; passwords in examples are synthetic  
- EC2/VM used for validation; primary reproducible path is Compose + published images  
- Frontend may call the API via configured host/IP for the demo environment; prefer relative/env-based API URL for multi-host use (noted as improvement in the decision memo)
