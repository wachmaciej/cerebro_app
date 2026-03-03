# Cerebro Web App — Data Collection Goal

## What We're Replacing

The old workflow (`Cerebro API Big Query/`) was:
1. Open Google Sheets → read ASINs per marketplace tab
2. Run a Python script manually per marketplace
3. Script calls Helium10 Cerebro API → saves keyword data to BigQuery
4. Script marks rows as "Done" in Google Sheets

**We're replacing Google Sheets with PostgreSQL** and **manual script runs with scheduled Celery tasks** triggered from the web UI.

---

## What We Want to Achieve

### Goal
Schedule automated data collection from the web app so that on a configured day (e.g. 1st of month), the system automatically:
1. Reads ASINs from PostgreSQL (grouped by marketplace)
2. Calls Helium10 Cerebro API for each batch of ASINs
3. Saves keyword data to BigQuery (same tables/schema as before)
4. Logs execution status back to the web UI

### No More
- Google Sheets dependency (ASINs live in PostgreSQL now)
- Manual script execution per marketplace
- `token.pickle` / OAuth flow (service account key handles BigQuery auth)

---

## Data Flow (New)

```
Web UI (Schedules page)
  └─ User creates schedule: marketplace=US, frequency=monthly, day=1
        │
        ▼
PostgreSQL: schedules table
  └─ {marketplace: "US", cron: "0 0 1 * *", is_active: true}
        │
        ▼
Celery Beat (reads DB schedules every minute)
  └─ When cron matches → fires Celery task: run_cerebro_fetcher("US", log_id)
        │
        ▼
Celery Worker executes task:
  1. Read ASINs for US from PostgreSQL
  2. Split into batches of 10
  3. For each batch:
     a. POST /api/v1/cerebro/product/multi-report → get report_id
     b. Wait 15s, then poll GET /report/{report_id} until SUCCESS
     c. Parse keyword + organic_rank per ASIN from response
     d. Append rows to BigQuery table: morpheus-sql-database.cerebro_data.us_keywords
  4. Update execution_log: status=SUCCESS, counts
        │
        ▼
BigQuery: us_keywords table
  └─ New rows with asin, keyword, search_volume, organic_rank, fetch_date, fetch_month, fetch_year
```

---

## Helium10 Cerebro API — How It Works

**Base URL:** `https://members.helium10.com/api/v1/cerebro/product`

**Auth:** `Authorization: Bearer {API_TOKEN}`

### Step 1 — Create Report (batch up to 10 ASINs)
```
POST /multi-report
Body: { "marketplace": "ATVPDKIKX0DER", "asins": ["B08XYZ", "B09ABC", ...] }
Response: { "results": { "reportId": 1000349 } }
```

### Step 2 — Poll Status
```
GET /report/{reportId}
Response when ready: [ { "phrase": "keyword", "searchVolume": 5000, "B08XYZ": 3, "B09ABC": null, ... }, ... ]
Response when pending: { "results": { "status": "IN_PROGRESS" } }
```
- Wait 15s after creating, then poll every 15s, max 15 retries
- When response is a list → report is ready

### Step 3 — Parse Response
Each item in the list:
- `phrase` → keyword
- `searchVolume` → search_volume
- `{ASIN}` key → organic_rank for that ASIN (null = ASIN doesn't rank for this keyword)
- Only store rows where the ASIN's rank is not null

### Step 4 — Save to BigQuery
Table: `morpheus-sql-database.cerebro_data.{marketplace}_keywords`

Schema:
| Column | Type | Value |
|--------|------|-------|
| asin | STRING | The ASIN |
| keyword | STRING | `phrase` from API |
| search_volume | INTEGER | `searchVolume` from API |
| organic_rank | INTEGER | ASIN-keyed value from API |
| fetch_date | TIMESTAMP | datetime.now() |
| fetch_month | STRING | "YYYY-MM" e.g. "2026-03" |
| fetch_year | INTEGER | 2026 |

**Write mode:** WRITE_APPEND (historical data preserved each month)

---

## Marketplace IDs

| Code | Amazon Marketplace ID |
|------|-----------------------|
| US | ATVPDKIKX0DER |
| UK | A1F83G8C2ARO7P |
| CA | A2EUQ1WTGCTBG2 |
| DE | A1PA6795UKMFR9 |
| IT | APJ6JRA9NG5V4 |
| ES | A1RKKUPIHCS9HS |
| FR | A13V1IB3VIYZZH |

---

## What Needs to Be Fixed/Built

### 1. Fix `celery_worker.py`
- [ ] Add `load_dotenv()` so env vars (API token, Google credentials) are loaded
- [ ] Remove Google Sheets init from the fetcher when called from Celery (pass `skip_sheets=True` or restructure)
- [ ] BigQuery client should use service account key from `GOOGLE_APPLICATION_CREDENTIALS`

### 2. Fix `CerebroAPIBigQueryFetcher` for web app use
Current problem: `__init__` always calls `_init_google_sheets()`, which tries to load `token.pickle` / open a browser — this crashes in a headless Celery worker.

Fix: Add a parameter to skip Sheets init when ASINs come from DB instead.

### 3. Connect DB Schedules to Celery Beat
Current state: Schedules are stored in PostgreSQL but nothing reads them to fire tasks.

Need to build one of:
- **Option A (Simpler):** A Beat schedule that checks the DB every minute and fires overdue tasks
- **Option B (Proper):** Use `django-celery-beat` or a custom `PersistentScheduler` that reads cron from DB

### 4. Redis
Celery needs Redis as broker. Must be running before worker/beat start.

```bash
docker run -d -p 6379:6379 --name redis redis:alpine
```

### 5. Run Commands (local development)

**Terminal 1 — Backend API:**
```bash
cd Cerebro_web_app/backend
uvicorn main:app --reload --port 8000
```

**Terminal 2 — Celery Worker:**
```bash
cd Cerebro_web_app/backend
celery -A celery_worker worker --loglevel=info --pool=solo
```

**Terminal 3 — Celery Beat (scheduler):**
```bash
cd Cerebro_web_app/backend
celery -A celery_beat beat --loglevel=info
```

**Terminal 4 — Frontend:**
```bash
cd Cerebro_web_app/frontend
npm run dev
```

---

## BigQuery Tables Already Exist
The tables were created by the old scripts. We're appending new rows each month — no migration needed.

## Rate Limits
- 10s delay between parallel batch groups
- 15s initial wait after creating a report
- 15s between status poll retries
- Max 15 retries per report before timeout
