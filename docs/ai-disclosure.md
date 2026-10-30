# AI-use disclosure

I used AI assistance (ChatGPT / Claude / Cursor) on this assessment. My main focus was **DevOps** (Docker, Compose, CI/CD, security scans, deploy/rollback, evidence)—not application coding. I ran the commands, tested on the VM, reviewed what AI suggested, and can explain the solution in review.

## App code (backend / frontend)

Coding the app was **not** my main task. I used AI for the **backend and frontend coding portion** (API / UI), then wired that into Docker, Compose, and the pipeline myself.

## Concepts, edits, and logs

- **Concepts:** to clear DevOps ideas I was unsure about.
- **Edits:** when I got stuck changing a file and needed a small nudge.
- **Logs:** when a pipeline or container log was hard to read.

**Docker Compose:** I already had a basic idea; I used AI only to clear a few **concepts**, not to replace my understanding of how the stack runs.

**YAML:** My pipeline/Compose **concepts** were clear; I used AI mainly for **YAML syntax** (structure, indentation, valid keys) when writing or fixing those files.

## Non-root / `USER` (specific example)

I did not already know the Docker **non-root `USER`** practice. When the pipeline failed on Trivy (missing `USER` / DS-0002), I used AI to understand **why** it failed and what non-root means. Then I added `USER node` / `USER nginx` and verified a green run. Other CI failures (Trivy version, image CVEs, Docker Hub token scopes) — same pattern: AI to interpret the error, then I applied and checked the fix.

## Documentation (**with the help of AI**)

**With the help of AI**, I drafted the **README**, runbook, decision memo, architecture notes, and other docs I uploaded to GitHub—after I explained my real setup and evidence to the AI. I did **not** upload that text as-is: I **reviewed and refined** it, then committed/uploaded.

## Honesty

AI helped with app code drafts, YAML syntax, concept checks, failure explanation, and documentation (**with the help of AI**, then refined by me). The demos, screenshots, and pipeline results are work I executed and can defend in the live review.
