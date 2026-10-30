# BrightBank runbook

Operational steps for deploy, rollback, incident response, and troubleshooting. Synthetic demo data only.

---

## 1. Deploy

### Prerequisites
- Docker + Compose v2 on the host
- Access to Docker Hub images `abmaxx/brightbank-backend` and `abmaxx/brightbank-frontend`
- Root `.env` with `DOCKERHUB_USER`, `TAG` (existing 7-char SHA), and DB variables matching `compose.yml`

### Steps
```bash
cd ~/brightbank   # or clone path
# confirm TAG exists on Docker Hub for BOTH images
cat .env
docker compose pull
docker compose up -d
docker compose ps
```

### Verify
```bash
docker exec brightbank-backend whoami      # expect: node
docker exec brightbank-frontend whoami     # expect: nginx
curl http://localhost:5000/api/health
curl http://localhost:5000/api/ready
```
Open `http://<HOST_IP>:8080` — deposit and withdraw once.

**Evidence:** `evidence/09-deploy-compose.png`, `evidence/10-upgraded-to-new-version.png` (or UI shot).

---

## 2. Rollback

Rollback = run the previous known-good image tag (no rebuild required).

```bash
# Example: roll back from a710df8 → 728bf68
sed -i 's/^TAG=.*/TAG=728bf68/' .env
cat .env
docker compose pull
docker compose up -d
docker compose ps
docker inspect --format '{{.Config.Image}}' brightbank-backend brightbank-frontend
```

Confirm UI/footer matches the older release.

**Evidence:** `evidence/11-rollback-to-old-version.png`, `evidence/13-rollback-evidence.PNG`.

---

## 3. Incident response

### Severity guide
| Signal | Likely class |
|--------|----------------|
| Container exited / restart loop | App or config |
| `/api/health` down | Backend process |
| `/api/health` alive + `/api/ready` 503 | Dependency (DB) |
| Site loads, API CORS/errors | Frontend↔backend URL/network |

### Failure investigation — MySQL down (executed demo)

**Symptom:** API cannot serve DB-backed readiness / transactions fail.

**Detection**
```bash
curl http://localhost:5000/api/health   # alive
curl -i http://localhost:5000/api/ready # 503 not_ready / database disconnected
```

**Diagnosis**
```bash
docker compose ps
docker logs --tail 30 brightbank-backend   # structured JSON: Readiness check failed
```

**Root cause (demo):** MySQL container stopped → DNS/TCP to host `mysql` fails.

**Fix**
```bash
docker start brightbank-mysql
# wait until healthy
curl http://localhost:5000/api/ready      # 200 connected
```

**Prevention:** alert on ready≠200 for N minutes; keep mysql restart policy; separate liveness vs readiness in any future orchestrator.

**Evidence:** `evidence/12-mysql-db-down.png` (or similarly named).

### CI-side investigation (real pipeline failure)

Trivy DS-0002 flagged missing `USER` in Dockerfiles → `security` / scan failed → no push. Fix: `USER node` / `USER nginx`. Shows scan gate working; not a substitute for the runtime investigation above.

---

## 4. Troubleshooting

| Problem | Checks | Fix |
|---------|--------|-----|
| `compose pull` tag not found | Docker Hub tags; same TAG on both repos | Set `TAG` to a published SHA |
| Site not reachable on :8080 | `compose ps`; host firewall/SG for 8080 | Open port; confirm `8080:8080` mapping |
| Ready always 503 | mysql healthy?; `DB_HOST=mysql` on Compose network | Start mysql; fix env; check logs |
| Backend as `root` | `docker exec … whoami` | Redeploy non-root image from pipeline |
| `.env` inside image | `ls -a /app` | Ensure `.dockerignore` has `.env`; rebuild via CI |
| CI red on tests | Actions log | Fix test/code; intentional-fail demo used `alive`→`dead` then revert |
| Push auth / scopes | Actions “Push images” log | Valid `DOCKERHUB_TOKEN` with write; username exact |

---

## 5. Metrics & alert proposal

Not installed in this assessment (kept cost/scope low). Suggested starter set:

| Signal | Source idea | Alert idea |
|--------|-------------|------------|
| HTTP 5xx rate | reverse proxy / app logs | >2% for 5 min |
| `/api/ready` failures | blackbox curl or uptime check | any 503 for 2 min |
| Container restarts | Docker / host metrics | >3 in 15 min |
| DB connection errors | backend JSON logs (`Readiness check failed`) | burst >10/min |
| Deploy lag | time from green CI to compose up | process SLO only |

---

## 6. Secrets & access (ops)

- Never commit `.env` or tokens
- Rotate Docker Hub PAT if leaked; update GitHub Actions secret
- Demo DB passwords are synthetic — change before any shared/non-demo use
