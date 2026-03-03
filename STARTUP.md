# Local Development Startup Guide

## Prerequisites (one-time setup)

### 1. Install Python dependencies
```bash
cd C:\Users\MaciejWach\Projects\cerebro_automation\Cerebro_web_app\backend
pip install -r requirements.txt
```

### 2. Install Node dependencies
```bash
cd C:\Users\MaciejWach\Projects\cerebro_automation\Cerebro_web_app\frontend
npm install
```

### 3. Start Redis (requires Docker)
```bash
docker run -d -p 6379:6379 --name redis redis:alpine
```
> Only needed once — Docker will keep it running. To restart after reboot: `docker start redis`

---

## Daily Startup — Open 4 terminals

### Terminal 1 — FastAPI Backend
```bash
cd C:\Users\MaciejWach\Projects\cerebro_automation\Cerebro_web_app\backend
uvicorn main:app --reload --port 8000
```
API available at: http://localhost:8000

---

### Terminal 2 — Celery Worker (executes fetch tasks)
```bash
cd C:\Users\MaciejWach\Projects\cerebro_automation\Cerebro_web_app\backend
celery -A celery_worker worker --loglevel=info --pool=solo
```
> Processes the actual data fetching jobs (Helium10 API → BigQuery)

---

### Terminal 3 — Celery Beat (fires scheduled tasks)
```bash
cd C:\Users\MaciejWach\Projects\cerebro_automation\Cerebro_web_app\backend
celery -A celery_worker beat --loglevel=info
```
> Checks DB schedules every minute and fires tasks when the cron time matches

---

### Terminal 4 — Next.js Frontend
```bash
cd C:\Users\MaciejWach\Projects\cerebro_automation\Cerebro_web_app\frontend
npm run dev
```
App available at: http://localhost:3000

---

## First-time app configuration

After all 4 terminals are running:

1. Open http://localhost:3000
2. Go to **Settings** in the sidebar
3. Paste your Helium10 API token and click **Save Token**
4. Go to **ASINs** — upload your ASINs via CSV or add them manually
5. Go to **Schedules** — create a schedule (e.g. US marketplace, monthly on day 1)

That's it. When the scheduled time arrives, Beat fires the task automatically.

---

## Verify everything is working

| Service | How to check |
|---------|-------------|
| Backend | Open http://localhost:8000/docs |
| Redis | Run `docker ps` — should show redis container running |
| Celery Worker | Terminal 2 should show `[*] Mingle: sync with ...` |
| Celery Beat | Terminal 3 should show `beat: Starting...` |
| Frontend | Open http://localhost:3000 |

---

## Troubleshooting

**Redis connection error in worker/beat:**
```bash
docker start redis
```

**`celery_worker` import error on startup:**
- Make sure you are in the `backend` folder when running celery commands
- Make sure `pip install -r requirements.txt` was run

**BigQuery authentication error:**
- Check that `GOOGLE_APPLICATION_CREDENTIALS` in `.env` points to the correct file:
  `C:/Users/MaciejWach/Projects/cerebro_automation/Cerebro_web_app/backend/cerebro_fetcher/morpheus-sql-database-885f6d117879.json`

**Database connection error:**
- The PostgreSQL is on the VPS (31.97.119.125) — make sure you have internet access
