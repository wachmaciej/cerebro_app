"""
ES Cerebro API Data Fetcher with BigQuery
Fetches keyword data from Helium10 Cerebro API for ES marketplace ASINs
"""

import os
import sys
from pathlib import Path

# Add parent directory to path to import the main fetcher
parent_dir = Path(__file__).parent.parent
sys.path.insert(0, str(parent_dir))

from cerebro_bigquery_fetcher import CerebroAPIBigQueryFetcher
from config import (
    API_TOKEN, BIGQUERY_PROJECT_ID, BIGQUERY_DATASET, 
    BIGQUERY_TABLES, MARKETPLACE_IDS, TRACKING_SPREADSHEET_ID
)

# Configuration
MARKETPLACE = 'ES'
CREDENTIALS_PATH = str(parent_dir / 'morpheus-cerebro-big-query.json')


def main():
    """Main entry point for ES marketplace"""
    print(f"\n{'='*60}")
    print(f"CEREBRO BIGQUERY FETCHER - {MARKETPLACE} MARKETPLACE")
    print(f"{'='*60}\n")
    
    config = {
        'project_id': BIGQUERY_PROJECT_ID,
        'dataset': BIGQUERY_DATASET,
        'tables': BIGQUERY_TABLES,
        'marketplace_ids': MARKETPLACE_IDS,
        'spreadsheet_id': TRACKING_SPREADSHEET_ID
    }
    
    # Initialize fetcher
    fetcher = CerebroAPIBigQueryFetcher(API_TOKEN, CREDENTIALS_PATH, config)
    
    # Fetch from Google Sheet
    fetcher.fetch_from_google_sheet(MARKETPLACE)


if __name__ == "__main__":
    main()
