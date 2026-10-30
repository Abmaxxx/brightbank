# AI-use disclosure

AI assistance was used on this assessment. I ran commands, verified results, fixed failures, and can explain the submitted design in review.

## Tools used

- ChatGPT / Claude (chat) — assessment guidance, Docker/Compose commands, CI YAML drafts, debugging prompts  
- Cursor (IDE agent) — editing help and explanations while working on related machine setup  

## Specific uses

| Area | AI role | My role |
|------|---------|---------|
| Dockerfiles / `.dockerignore` / non-root `USER` | Suggested file contents and Compose port `8080:8080` | Applied on VM, rebuilt, verified `whoami` |
| `.gitignore` | Proposed patterns | Trimmed to what the repo actually needed; kept secrets out of git |
| Backend testability (`module.exports`, Jest, ESLint) | Drafted tests and lint config | Ran `npm test` / `npm run lint`; confirmed 6 passing checks |
| `.github/workflows/ci.yml` | Drafted test / security / build-and-push jobs | Pushed, watched Actions, iterated on real failures |
| Trivy action version / CVE fixes | Explained errors; suggested pin upgrade and `apk upgrade` | Chose versions, committed, re-ran until green |
| Docker Hub token / scopes | Guided token + secret setup | Created tokens/secrets; confirmed push from pipeline |
| Deploy / rollback / MySQL incident | Step lists for evidence | Executed on EC2; captured screenshots |
| README, runbook, decision memo, architecture | Drafted documentation structure and wording | Reviewed against actual repo behavior and evidence |

## What AI did **not** do

- Did not access Apex production systems or real customer data  
- Did not replace understanding of the pipeline: I can walk through each job, why push is blocked on failure, and how rollback via `TAG` works  

## Honesty note

Undisclosed AI use is a red flag in the brief. This file is the disclosure. During the live review I will demo deploy/rollback and explain trade-offs in my own words.
