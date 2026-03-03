# VPS Deployment Guide

## VPS Details
- IP: 31.97.119.125
- PostgreSQL already running on port 5432 (database: cerebro_data, user: maciej)
- Docker must be installed on the VPS

---

## What Was Already Fixed (code changes done)

These changes were made to the codebase and are ready to deploy:

| What | Why |
|------|-----|
| All `http://localhost:8000` in frontend replaced with `API_URL` env var | App would not work on VPS with hardcoded localhost |
| Created `frontend/src/lib/api.ts` — single source of truth for API URL | |
| Created `backend/Dockerfile` | Docker needs it to build the backend image |
| Created `frontend/Dockerfile` | Docker needs it to build the frontend image |
| Rewrote `docker-compose.yml` | Old one was outdated (wrong DB creds, missing beat, wrong celery command) |
| Updated `next.config.ts` to pass `NEXT_PUBLIC_API_URL` at build time | Next.js bakes env vars in at build, not runtime |

---

## Step-by-Step Deployment

### Step 1 — Copy the project to your VPS

On your local machine, from the project root:
```bash
scp -r "C:\Users\MaciejWach\Projects\cerebro_automation\Cerebro_web_app" root@31.97.119.125:/opt/cerebro
```
Or use any SFTP client (FileZilla, WinSCP) to upload the `Cerebro_web_app` folder to `/opt/cerebro` on the VPS.

---

### Step 2 — SSH into the VPS
```bash
ssh root@31.97.119.125
cd /opt/cerebro
```

---

### Step 3 — Create the backend `.env` file on the VPS

```bash
nano /opt/cerebro/backend/.env
```

Paste this content (replace the token with the real one):
```
DATABASE_URL=postgresql://maciej:Redislandtree2!@31.97.119.125:5432/cerebro_data
REDIS_URL=redis://redis:6379/0

HELIUM10_API_TOKEN=your_helium10_api_token_here

TRACKING_SPREADSHEET_ID=1Ijm_oyxJTlA0U30oqI2AZV9LMTH67WxVBNKidPU22ho

BIGQUERY_PROJECT_ID=morpheus-sql-database
BIGQUERY_DATASET=cerebro_data
GOOGLE_APPLICATION_CREDENTIALS=/app/cerebro_fetcher/morpheus-sql-database-885f6d117879.json
```

> **Important:** `REDIS_URL` uses `redis://redis:6379/0` (the Docker service name), not localhost.
> **Important:** `GOOGLE_APPLICATION_CREDENTIALS` uses `/app/...` (the container path), not your local Windows path.

---

### Step 4 — Verify the service account key is present

Check the file exists on the VPS:
```bash
ls /opt/cerebro/backend/cerebro_fetcher/morpheus-sql-database-885f6d117879.json
```

If it's missing (wasn't uploaded), copy it from your local machine:
```bash
# Run this on your local machine:
scp "C:\Users\MaciejWach\Projects\cerebro_automation\Cerebro_web_app\backend\cerebro_fetcher\morpheus-sql-database-885f6d117879.json" root@31.97.119.125:/opt/cerebro/backend/cerebro_fetcher/
```

---

### Step 5 — Build and start everything
```bash
cd /opt/cerebro
docker-compose up -d --build
```

This builds and starts 4 containers:
- `redis` — message broker
- `backend` — FastAPI on port 8000
- `celery_worker` — processes fetch jobs
- `celery_beat` — fires scheduled tasks every minute
- `frontend` — Next.js on port 3000

---

### Step 6 — Verify containers are running
```bash
docker-compose ps
```

All should show `Up`. Check logs if anything is wrong:
```bash
docker-compose logs backend
docker-compose logs celery_worker
docker-compose logs frontend
```

---

### Step 7 — Open the app

- Frontend: http://31.97.119.125:3000
- Backend API docs: http://31.97.119.125:8000/docs

---

### Step 8 — Configure the API token in the app

1. Open http://31.97.119.125:3000
2. Go to **Settings**
3. Paste your Helium10 API token
4. Click **Save Token**

---

## Firewall — Open required ports on VPS

Make sure these ports are open:
```bash
ufw allow 3000   # Frontend
ufw allow 8000   # Backend API
ufw allow 6379   # Redis (optional, only if needed externally)
```

---

## Useful commands on VPS

```bash
# Restart everything
docker-compose restart

# Stop everything
docker-compose down

# View live logs
docker-compose logs -f

# Rebuild after code changes
docker-compose up -d --build

# Check a specific container's logs
docker-compose logs -f celery_worker
```

---

## After code changes (redeploy)

Every time you update the code on your local machine:

1. Upload changed files to VPS (scp or SFTP)
2. On the VPS:
```bash
cd /opt/cerebro
docker-compose up -d --build
```

---

## Database note

PostgreSQL is running directly on the VPS (not in Docker). The backend connects to it via:
```
postgresql://maciej:Redislandtree2!@31.97.119.125:5432/cerebro_data
```
No migration needed — the app creates the `cerebro` schema and tables automatically on first start.
