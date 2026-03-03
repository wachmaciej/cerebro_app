"""
BigQuery Backup Script
Copies all tables from cerebro_data -> cerebro_data_backup_YYYYMMDD
Run this once before making any changes.
"""

import os
from datetime import datetime
from dotenv import load_dotenv
from google.cloud import bigquery
from google.oauth2 import service_account

load_dotenv()

PROJECT_ID = os.getenv("BIGQUERY_PROJECT_ID", "morpheus-sql-database")
SOURCE_DATASET = os.getenv("BIGQUERY_DATASET", "cerebro_data")
BACKUP_DATASET = f"cerebro_data_backup_{datetime.now().strftime('%Y%m%d')}"
CREDS_PATH = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")

TABLES = [
    "us_keywords",
    "uk_keywords",
    "ca_keywords",
    "de_keywords",
    "it_keywords",
    "es_keywords",
    "fr_keywords",
]


def get_client():
    if CREDS_PATH and os.path.exists(CREDS_PATH):
        creds = service_account.Credentials.from_service_account_file(CREDS_PATH)
        return bigquery.Client(project=PROJECT_ID, credentials=creds)
    return bigquery.Client(project=PROJECT_ID)


def create_backup_dataset(client: bigquery.Client):
    dataset_id = f"{PROJECT_ID}.{BACKUP_DATASET}"
    try:
        client.get_dataset(dataset_id)
        print(f"  Backup dataset already exists: {BACKUP_DATASET}")
    except Exception:
        dataset = bigquery.Dataset(dataset_id)
        dataset.location = "US"
        client.create_dataset(dataset)
        print(f"  Created backup dataset: {BACKUP_DATASET}")


def copy_table(client: bigquery.Client, table_name: str):
    source = f"{PROJECT_ID}.{SOURCE_DATASET}.{table_name}"
    dest = f"{PROJECT_ID}.{BACKUP_DATASET}.{table_name}"

    job_config = bigquery.CopyJobConfig(
        write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE
    )

    job = client.copy_table(source, dest, job_config=job_config)
    job.result()  # wait for completion

    source_table = client.get_table(source)
    print(f"  Copied {table_name}: {source_table.num_rows:,} rows")


def main():
    print(f"\nBigQuery Backup")
    print(f"  Source : {PROJECT_ID}.{SOURCE_DATASET}")
    print(f"  Dest   : {PROJECT_ID}.{BACKUP_DATASET}")
    print()

    client = get_client()
    print("Connected to BigQuery")

    print(f"\nCreating backup dataset...")
    create_backup_dataset(client)

    print(f"\nCopying tables...")
    success = 0
    failed = 0

    for table in TABLES:
        try:
            copy_table(client, table)
            success += 1
        except Exception as e:
            print(f"  SKIP {table}: {e}")
            failed += 1

    print(f"\nDone. {success} tables copied, {failed} skipped (empty/missing tables are normal).")
    print(f"Backup location: {PROJECT_ID}.{BACKUP_DATASET}")
    print(f"\nTo restore a table if needed, run in BigQuery console:")
    print(f"  CREATE OR REPLACE TABLE `{PROJECT_ID}.{SOURCE_DATASET}.us_keywords`")
    print(f"  AS SELECT * FROM `{PROJECT_ID}.{BACKUP_DATASET}.us_keywords`")


if __name__ == "__main__":
    main()
