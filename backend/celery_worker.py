import os
from dotenv import load_dotenv
load_dotenv()

from celery import Celery
from celery.schedules import crontab
import logging

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "cerebro_tasks",
    broker=REDIS_URL,
    backend=REDIS_URL
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # Beat runs this task every minute to check DB schedules
    beat_schedule={
        "check-db-schedules-every-minute": {
            "task": "check_db_schedules",
            "schedule": 60.0,
        }
    },
)


@celery_app.task(name="check_db_schedules")
def check_db_schedules():
    """
    Runs every minute via Celery Beat.
    Reads active schedules from the database and fires run_cerebro_fetcher
    when the cron expression matches the current minute.
    """
    from database import SessionLocal
    import crud, schemas
    from croniter import croniter
    from datetime import datetime, timezone

    logger = logging.getLogger(__name__)
    db = SessionLocal()
    try:
        schedules = crud.get_schedules(db, limit=1000)
        now = datetime.now(timezone.utc)

        for schedule in schedules:
            if not schedule.is_active:
                continue
            try:
                cron = croniter(schedule.cron_expression, now)
                prev_run = cron.get_prev(datetime)
                # Fire if the last scheduled trigger was within the past 60 seconds
                seconds_since = (now - prev_run).total_seconds()
                if seconds_since <= 60:
                    log = crud.create_execution_log(db, schemas.ExecutionLogCreate(
                        schedule_id=schedule.id,
                        status="QUEUED",
                        marketplace=schedule.marketplace
                    ))
                    run_cerebro_fetcher.delay(schedule.marketplace, log.id)
                    logger.info(f"Fired task for schedule {schedule.id} ({schedule.marketplace})")
            except Exception as e:
                logger.error(f"Error checking schedule {schedule.id}: {e}")
    finally:
        db.close()


@celery_app.task(bind=True, name="run_cerebro_fetcher")
def run_cerebro_fetcher(self, marketplace: str, execution_log_id: int):
    """
    Fetches Cerebro keyword data for a marketplace and saves to BigQuery.
    ASINs are read from PostgreSQL (not Google Sheets).
    """
    logger = logging.getLogger(__name__)
    logger.info(f"Starting Cerebro Fetcher for marketplace: {marketplace}")

    from database import SessionLocal
    import crud
    db = SessionLocal()

    try:
        from cerebro_fetcher.cerebro_bigquery_fetcher import CerebroAPIBigQueryFetcher
        from cerebro_fetcher.config import MARKETPLACE_IDS, BIGQUERY_PROJECT_ID, BIGQUERY_DATASET, BIGQUERY_TABLES

        # 1. Get the API token from DB, fallback to env
        token_setting = crud.get_setting(db, "helium10_api_token")
        api_token = token_setting.value if token_setting else os.getenv("HELIUM10_API_TOKEN")
        if not api_token:
            raise Exception("Helium10 API Token is not configured.")

        # 2. Get ASINs for this marketplace from DB
        db_asins = crud.get_asins(db, limit=10000)
        marketplace_asins = [a.asin for a in db_asins if a.marketplace.upper() == marketplace.upper()]

        if not marketplace_asins:
            crud.update_execution_log(db, execution_log_id, status="SUCCESS", log_output="No ASINs to fetch for this marketplace.")
            db.close()
            return {"status": "success", "marketplace": marketplace, "fetched": 0}

        # 3. Setup Fetcher — skip_sheets=True because ASINs come from DB
        fetcher = CerebroAPIBigQueryFetcher(
            api_token=api_token,
            credentials_path="",  # unused when skip_sheets=True
            config={
                "project_id": BIGQUERY_PROJECT_ID,
                "dataset": BIGQUERY_DATASET,
                "tables": BIGQUERY_TABLES,
                "marketplace_ids": MARKETPLACE_IDS,
                "spreadsheet_id": "",  # unused when skip_sheets=True
            },
            skip_sheets=True,
        )

        marketplace_id = MARKETPLACE_IDS.get(marketplace.upper())
        if not marketplace_id:
            raise Exception(f"Invalid marketplace: {marketplace}")

        # 4. Process all ASINs in batches of 10
        batch_size = 10
        total_asins = len(marketplace_asins)
        total_batches = (total_asins + batch_size - 1) // batch_size

        successful_count = 0
        failed_count = 0

        for batch_num in range(0, total_asins, batch_size):
            batch_asins = marketplace_asins[batch_num:batch_num + batch_size]
            batch_idx = batch_num // batch_size + 1

            batch_dict = [{"asin": a, "row": 0, "cerebro_col": 0} for a in batch_asins]

            result = fetcher.process_single_batch(
                batch=batch_dict,
                batch_idx=batch_idx,
                total_batches=total_batches,
                marketplace=marketplace,
                marketplace_id=marketplace_id
            )

            successful_count += len(result.get("successful_asins", []))
            failed_count += len(result.get("failed_asins", []))

            crud.update_execution_log_progress(db, execution_log_id,
                f"Batch {batch_idx}/{total_batches} — {successful_count} ok, {failed_count} failed so far"
            )

        logger.info(f"Finished {marketplace}: {successful_count} success, {failed_count} failed")

        log_output = f"Fetched {successful_count} successfully, {failed_count} failed."
        crud.update_execution_log(db, execution_log_id, status="SUCCESS", log_output=log_output)
        db.close()
        return {"status": "success", "marketplace": marketplace, "success": successful_count, "failed": failed_count}

    except Exception as e:
        logger.error(f"Error in cerebro fetcher: {str(e)}")
        crud.update_execution_log(db, execution_log_id, status="FAILED", error_message=str(e))
        db.close()
        raise e
