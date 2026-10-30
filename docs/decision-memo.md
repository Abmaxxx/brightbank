# Decision memo — BrightBank DevOps assessment

Concise record of assumptions, choices, and trade-offs for the Apex Junior DevOps practical.

---

## Objective

Deliver a reviewable path from **code commit → tested/scanned image → deploy → rollback**, with evidence—not a slide-only design.

---

## Assumptions

1. **App:** BrightBank (frontend + Node API + MySQL) is an acceptable “minimal API” stand-in for an Apex Operations-style service.  
2. **Environment:** Primary reproducible path is **Docker Compose + images from Docker Hub**. An AWS EC2 VM was used to **validate** deploy/rollback/incident demos. Assessment text discourages paid cloud; EC2 was treated as a temporary lab host, not a required Apex/production system. A reviewer can reproduce on any Docker host using the README.  
3. **Data:** Synthetic demo only; no real customers or production credentials.  
4. **Scope:** One pipeline on `main`, manual Compose promote on the host (no Kubernetes/CD auto-deploy to keep the blast radius small in 48h).

---

## Key decisions

| Decision | Why | Trade-off |
|----------|-----|-----------|
| Compose `image:` + Hub tags (not `build:` on the VM) | Same artifact CI produced; rollback = change `TAG` | Host needs Hub access; first tags must exist |
| Tag = git SHA[:7] | Traceable to commit; no ambiguous `latest` | Operators must pick an existing tag |
| Non-root (`USER node` / `USER nginx`) | Assessment + Trivy DS-0002; reduces escape impact | Frontend briefly uses `USER root` only for `apk upgrade`, then back to `nginx` |
| Parallel `test` + `security`, then `build-and-push` | Failures block push; matches “block deployment when tests fail” | Slightly longer green path |
| Trivy + npm audit | Covers dependency/image scanning requirement | Base-image CVEs forced rebuild/upgrade loops |
| Jest with mocked MySQL | 6 automated API checks without CI needing a DB | Not a full integration test against real MySQL |
| Structured JSON logs + `/health` vs `/ready` | Cheap observability; clear incident split | No Prometheus installed (proposal only) |
| GitHub Actions secrets for Hub | No tokens in repo | Operator must configure secrets once |

---

## Security & configuration hygiene

- **Secrets:** `.env` gitignored; `.dockerignore` keeps `.env` out of images; Hub credentials only in Actions secrets.  
- **Least privilege:** non-root containers; app DB user (not using root for app queries in normal design).  
- **Scanning:** npm audit + Trivy fs + Trivy image before push.  
- **Cost-aware cloud path:** start with one small VM (or local Docker) + Compose + Hub; add managed MySQL and a container service later if load/SLA needs it—avoid multi-AZ Kubernetes for a demo API.

---

## What went wrong (useful evidence)

1. Invalid/compromised-era Trivy action pin → updated to a current safe tag.  
2. Missing `USER` → Trivy HIGH → fixed Dockerfiles.  
3. Alpine/nginx CVEs → `apk upgrade` in frontend image build.  
4. Docker Hub token scopes → fixed PAT; then pipeline pushed successfully.  

These were **real** gates, not staged theatre (separate from the intentional broken Jest expectation used to prove skip-of-push).

---

## Intentional failure

Temporarily changed health test expectation `alive` → `dead` on `main`, captured red `test` + skipped `build-and-push`, then restored. Proves CI blocks release artifacts when checks fail.

---

## What I’d improve with more time

1. Pin GitHub Actions to **full commit SHAs** (not movable tags).  
2. Relative/env-based API URL in frontend (remove any hard-coded host IP).  
3. `init.sql` mounted for fully empty-volume bootstrap.  
4. Split env files / secrets manager for non-demo hosts.  
5. Wire one real metric + alert (e.g. ready probe) instead of proposal-only.  
6. PR-based flow: intentional fail on a branch without redding `main`.

---

## Review talking points

- Why two endpoints (liveness vs readiness)  
- Why SHA tags beat `latest` for rollback  
- How Trivy USER finding maps to least privilege  
- How to roll back in under a minute with Compose  
