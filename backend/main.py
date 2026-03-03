import os
from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List

import models, schemas, crud
from database import SessionLocal, engine
from celery_worker import run_cerebro_fetcher
from sqlalchemy import text

# Create schema and tables in DB
with engine.connect() as conn:
    conn.execute(text("CREATE SCHEMA IF NOT EXISTS cerebro"))
    conn.commit()

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Cerebro Automation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Match Next.js frontend port later or use *
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"message": "Cerebro API is running"}

@app.get("/api/dashboard/stats", response_model=schemas.DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db)):
    return crud.get_dashboard_stats(db)

@app.get("/api/dashboard/marketplace-breakdown")
def get_marketplace_breakdown(db: Session = Depends(get_db)):
    from sqlalchemy import func
    results = db.query(
        models.AsinTrack.marketplace,
        func.count(models.AsinTrack.id).label("count")
    ).group_by(models.AsinTrack.marketplace).order_by(func.count(models.AsinTrack.id).desc()).all()
    return [{"marketplace": r.marketplace, "count": r.count} for r in results]

@app.get("/api/schedules/", response_model=List[schemas.Schedule])
def read_schedules(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_schedules(db, skip=skip, limit=limit)

@app.post("/api/schedules/", response_model=schemas.Schedule)
def create_schedule(schedule: schemas.ScheduleCreate, db: Session = Depends(get_db)):
    return crud.create_schedule(db=db, schedule=schedule)

@app.put("/api/schedules/{schedule_id}", response_model=schemas.Schedule)
def update_schedule(schedule_id: int, schedule: schemas.ScheduleCreate, db: Session = Depends(get_db)):
    updated = crud.update_schedule(db=db, schedule_id=schedule_id, schedule=schedule)
    if not updated:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return updated

@app.put("/api/schedules/{schedule_id}/toggle", response_model=schemas.Schedule)
def toggle_schedule(schedule_id: int, db: Session = Depends(get_db)):
    schedule = crud.toggle_schedule_active(db=db, schedule_id=schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return schedule

@app.delete("/api/schedules/{schedule_id}")
def delete_schedule(schedule_id: int, db: Session = Depends(get_db)):
    success = crud.delete_schedule(db=db, schedule_id=schedule_id)
    if not success:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return {"message": "Schedule deleted"}

@app.get("/api/asins/", response_model=List[schemas.AsinTrack])
def read_asins(skip: int = 0, limit: int = 50, marketplace: str = None, search: str = None, db: Session = Depends(get_db)):
    return crud.get_asins(db, skip=skip, limit=limit, marketplace=marketplace, search=search)

@app.get("/api/asins/marketplaces", response_model=List[str])
def read_marketplaces(db: Session = Depends(get_db)):
    return crud.get_unique_marketplaces(db)

@app.post("/api/asins/", response_model=schemas.AsinTrack)
def create_asin(asin: schemas.AsinTrackCreate, db: Session = Depends(get_db)):
    return crud.create_asin(db=db, asin=asin)

@app.delete("/api/asins/{asin_id}")
def delete_asin(asin_id: int, db: Session = Depends(get_db)):
    success = crud.delete_asin(db=db, asin_id=asin_id)
    if not success:
        raise HTTPException(status_code=404, detail="ASIN not found")
    return {"message": "ASIN deleted"}

@app.get("/api/logs/", response_model=List[schemas.ExecutionLog])
def read_logs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_logs(db, skip=skip, limit=limit)

@app.delete("/api/logs/")
def clear_logs(db: Session = Depends(get_db)):
    deleted = crud.clear_completed_logs(db)
    return {"deleted": deleted}

@app.post("/api/fetch/trigger/")
def trigger_fetch(marketplace: str, db: Session = Depends(get_db)):
    log_create = schemas.ExecutionLogCreate(
        status="QUEUED",
        marketplace=marketplace
    )
    db_log = crud.create_execution_log(db, log_create)
    # Launch celery task
    run_cerebro_fetcher.delay(marketplace, db_log.id)
    return {"message": "Fetch task queued", "log_id": db_log.id}

@app.get("/api/settings/{key}", response_model=schemas.Setting)
def get_setting(key: str, db: Session = Depends(get_db)):
    setting = crud.get_setting(db=db, key=key)
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    return setting

@app.post("/api/settings/", response_model=schemas.Setting)
def save_setting(setting: schemas.SettingCreate, db: Session = Depends(get_db)):
    return crud.set_setting(db=db, setting=setting)

import httpx

@app.get("/api/balance")
def get_api_balance(db: Session = Depends(get_db)):
    token_setting = crud.get_setting(db=db, key="helium10_api_token")
    api_token = token_setting.value if token_setting else os.getenv("HELIUM10_API_TOKEN")
    if not api_token:
        raise HTTPException(status_code=400, detail="Helium10 API token is not configured.")
    try:
        resp = httpx.get(
            "https://members.helium10.com/api/v1/cerebro/product/report-balance",
            headers={"Authorization": f"Bearer {api_token}"},
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail="Helium10 API returned an error.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from fastapi import UploadFile, File
import pandas as pd
import io

@app.post("/api/asins/upload/")
def upload_asins_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload a CSV.")
    
    try:
        contents = file.file.read()
        df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
        
        required_columns = ['ASIN', 'Marketplace']
        if not all(col in df.columns for col in required_columns):
            raise HTTPException(status_code=400, detail=f"CSV must contain columns: {', '.join(required_columns)}")
            
        added_count = 0
        for index, row in df.iterrows():
            asin_str = str(row['ASIN']).strip()
            marketplace_str = str(row['Marketplace']).strip().upper()
            
            if not asin_str or not marketplace_str:
                continue
                
            # Check if ASIN already exists for this marketplace
            existing = db.query(models.AsinTrack).filter(
                models.AsinTrack.asin == asin_str,
                models.AsinTrack.marketplace == marketplace_str
            ).first()
            
            if not existing:
                new_asin = models.AsinTrack(
                    asin=asin_str,
                    marketplace=marketplace_str,
                    tags="uploaded_via_csv"
                )
                db.add(new_asin)
                added_count += 1
                
        db.commit()
        return {"message": f"Successfully uploaded {added_count} new ASINs."}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error processing CSV: {str(e)}")
    finally:
        file.file.close()

from fastapi.responses import Response
from google.cloud import bigquery as bq
from google.oauth2 import service_account as sa

def get_bigquery_client():
    project_id = os.getenv("BIGQUERY_PROJECT_ID", "morpheus-sql-database")
    creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")
    creds = sa.Credentials.from_service_account_file(creds_path)
    return bq.Client(project=project_id, credentials=creds)

BIGQUERY_TABLES = {
    "US": "us_keywords", "UK": "uk_keywords", "CA": "ca_keywords",
    "DE": "de_keywords", "IT": "it_keywords", "ES": "es_keywords", "FR": "fr_keywords"
}

@app.get("/api/bigquery/market-overview")
def get_market_overview():
    client = get_bigquery_client()
    dataset = os.getenv("BIGQUERY_DATASET", "cerebro_data")
    project = os.getenv("BIGQUERY_PROJECT_ID", "morpheus-sql-database")

    results = []
    for marketplace, table in BIGQUERY_TABLES.items():
        try:
            query = f"""
                WITH top_keywords AS (
                    SELECT keyword
                    FROM `{project}.{dataset}.{table}`
                    WHERE search_volume > 0
                    GROUP BY keyword
                    ORDER BY MAX(search_volume) DESC
                    LIMIT 100
                )
                SELECT
                    t.fetch_month,
                    ROUND(AVG(t.search_volume), 0) AS avg_search_volume,
                    ROUND(AVG(t.organic_rank), 1) AS avg_organic_rank
                FROM `{project}.{dataset}.{table}` t
                INNER JOIN top_keywords tk ON t.keyword = tk.keyword
                WHERE t.search_volume > 0
                  AND t.organic_rank IS NOT NULL
                  AND t.organic_rank > 0
                GROUP BY t.fetch_month
                ORDER BY t.fetch_month
            """
            rows = client.query(query).result()
            for row in rows:
                results.append({
                    "marketplace": marketplace,
                    "month": row.fetch_month,
                    "avg_search_volume": row.avg_search_volume,
                    "avg_organic_rank": row.avg_organic_rank,
                })
        except Exception:
            pass  # Table doesn't exist or has no data yet
    return results

@app.get("/api/bigquery/keywords")
def get_keywords_for_asin(asin: str, marketplace: str):
    table = BIGQUERY_TABLES.get(marketplace.upper())
    if not table:
        raise HTTPException(status_code=400, detail="Invalid marketplace")
    dataset = os.getenv("BIGQUERY_DATASET", "cerebro_data")
    project = os.getenv("BIGQUERY_PROJECT_ID", "morpheus-sql-database")
    client = get_bigquery_client()
    query = f"""
        SELECT DISTINCT keyword, MAX(search_volume) as search_volume
        FROM `{project}.{dataset}.{table}`
        WHERE asin = @asin
        GROUP BY keyword
        ORDER BY search_volume DESC
    """
    job_config = bq.QueryJobConfig(
        query_parameters=[bq.ScalarQueryParameter("asin", "STRING", asin.strip().upper())]
    )
    try:
        results = client.query(query, job_config=job_config).result()
        return [{"keyword": row.keyword, "search_volume": row.search_volume} for row in results]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/bigquery/keyword-trend")
def get_keyword_trend(asin: str, marketplace: str, keyword: str):
    table = BIGQUERY_TABLES.get(marketplace.upper())
    if not table:
        raise HTTPException(status_code=400, detail="Invalid marketplace")
    dataset = os.getenv("BIGQUERY_DATASET", "cerebro_data")
    project = os.getenv("BIGQUERY_PROJECT_ID", "morpheus-sql-database")
    client = get_bigquery_client()
    query = f"""
        SELECT
            fetch_month,
            ROUND(AVG(search_volume), 0) as search_volume,
            ROUND(AVG(organic_rank), 1) as organic_rank
        FROM `{project}.{dataset}.{table}`
        WHERE asin = @asin AND keyword = @keyword
        GROUP BY fetch_month
        ORDER BY fetch_month ASC
    """
    job_config = bq.QueryJobConfig(
        query_parameters=[
            bq.ScalarQueryParameter("asin", "STRING", asin.strip().upper()),
            bq.ScalarQueryParameter("keyword", "STRING", keyword),
        ]
    )
    try:
        results = client.query(query, job_config=job_config).result()
        return [
            {"month": row.fetch_month, "search_volume": row.search_volume, "organic_rank": row.organic_rank}
            for row in results
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/asins/template/")
def download_csv_template():
    csv_content = "ASIN,Marketplace\nB08XYZ123,US\nB09ABC456,UK\n"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=asin_template.csv"}
    )
