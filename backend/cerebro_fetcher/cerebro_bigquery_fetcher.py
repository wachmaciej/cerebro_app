"""
Cerebro API Data Fetcher with BigQuery Integration
Fetches keyword data from Helium10 Cerebro API and stores in BigQuery
Reads ASINs from Google Sheets
"""

import os
import sys
import time
import json
import logging
import pickle
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
import pandas as pd
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from google.cloud import bigquery
from google.oauth2 import service_account

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('cerebro_bigquery_fetcher.log', encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Google Sheets Configuration
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

# API Configuration
API_BASE_URL = 'https://members.helium10.com/api/v1/cerebro/product'
DELAY_BETWEEN_REQUESTS = 10  # seconds
WAIT_FOR_REPORT = 15  # Initial wait before first status check
MAX_RETRIES = 15  # Max status check attempts
RETRY_DELAY = 15  # seconds between status checks

# Sheet tab names
SHEET_TABS = {
    'US': 'US',
    'UK': 'UK',
    'CA': 'CA',
    'DE': 'DE',
    'IT': 'IT',
    'ES': 'ES',
    'FR': 'FR'
}


class CerebroAPIBigQueryFetcher:
    """Fetch data from Cerebro API and store in BigQuery"""
    
    def __init__(self, api_token: str, credentials_path: str, config: dict, skip_sheets: bool = False):
        """
        Initialize the fetcher

        Args:
            api_token: Helium10 API token
            credentials_path: Path to Google OAuth credentials JSON
            config: Configuration dict with BigQuery and spreadsheet settings
            skip_sheets: If True, skip Google Sheets init (used when ASINs come from DB)
        """
        self.api_token = api_token
        self.credentials_path = credentials_path
        self.config = config
        self.sheets_service = None
        self.bigquery_client = None

        # Initialize Google Sheets only when running standalone (not from web app / Celery)
        if not skip_sheets:
            self._init_google_sheets()

        # Initialize BigQuery
        self._init_bigquery()
    
    def _init_google_sheets(self):
        """Initialize Google Sheets API connection"""
        creds = None
        token_path = 'token.pickle'
        
        if os.path.exists(token_path):
            with open(token_path, 'rb') as token:
                creds = pickle.load(token)
        
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                flow = InstalledAppFlow.from_client_secrets_file(
                    self.credentials_path, SCOPES)
                creds = flow.run_local_server(port=0)
            
            with open(token_path, 'wb') as token:
                pickle.dump(creds, token)
        
        self.sheets_service = build('sheets', 'v4', credentials=creds)
        logger.info("✓ Google Sheets API connected")
    
    def _init_bigquery(self):
        """Initialize BigQuery client and create dataset/tables if needed"""
        try:
            # Use service account key if GOOGLE_APPLICATION_CREDENTIALS is set, else ADC
            creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")
            if creds_path and os.path.exists(creds_path):
                creds = service_account.Credentials.from_service_account_file(creds_path)
                self.bigquery_client = bigquery.Client(project=self.config['project_id'], credentials=creds)
            else:
                self.bigquery_client = bigquery.Client(project=self.config['project_id'])
            
            # Create dataset if it doesn't exist
            self._create_dataset_if_not_exists()
            
            # Create tables for all marketplaces
            self._create_tables_if_not_exist()
            
            logger.info(f"✓ BigQuery connected to project: {self.config['project_id']}")
        except Exception as e:
            logger.error(f"Failed to initialize BigQuery: {e}")
            raise
    
    def _create_dataset_if_not_exists(self):
        """Create BigQuery dataset if it doesn't exist"""
        dataset_id = f"{self.config['project_id']}.{self.config['dataset']}"
        
        try:
            self.bigquery_client.get_dataset(dataset_id)
            logger.info(f"✓ Dataset {self.config['dataset']} already exists")
        except Exception:
            dataset = bigquery.Dataset(dataset_id)
            dataset.location = "US"
            dataset = self.bigquery_client.create_dataset(dataset, timeout=30)
            logger.info(f"✓ Created dataset {self.config['dataset']}")
    
    def _create_tables_if_not_exist(self):
        """Create BigQuery tables for all marketplaces if they don't exist"""
        schema = [
            bigquery.SchemaField("asin", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("keyword", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("search_volume", "INTEGER", mode="NULLABLE"),
            bigquery.SchemaField("organic_rank", "INTEGER", mode="NULLABLE"),
            bigquery.SchemaField("fetch_date", "TIMESTAMP", mode="REQUIRED"),
            bigquery.SchemaField("fetch_month", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("fetch_year", "INTEGER", mode="REQUIRED"),
        ]
        
        for marketplace, table_name in self.config['tables'].items():
            table_id = f"{self.config['project_id']}.{self.config['dataset']}.{table_name}"
            
            try:
                self.bigquery_client.get_table(table_id)
                logger.info(f"✓ Table {table_name} already exists")
            except Exception:
                table = bigquery.Table(table_id, schema=schema)
                # Enable partitioning by date for better query performance
                table.time_partitioning = bigquery.TimePartitioning(
                    type_=bigquery.TimePartitioningType.DAY,
                    field="fetch_date"
                )
                table = self.bigquery_client.create_table(table)
                logger.info(f"✓ Created table {table_name}")
    
    def get_asins_from_sheet(self, marketplace: str) -> List[Dict]:
        """
        Read ASINs from Google Sheet for a specific marketplace
        
        Args:
            marketplace: Marketplace code (US, UK, CA, DE, IT, ES, FR)
            
        Returns:
            List of dicts with ASIN and row information
        """
        tab_name = SHEET_TABS.get(marketplace)
        if not tab_name:
            logger.error(f"Invalid marketplace: {marketplace}")
            return []
        
        try:
            range_name = f"{tab_name}!A:H"  # Columns A-H (ASIN to Comment)
            result = self.sheets_service.spreadsheets().values().get(
                spreadsheetId=self.config['spreadsheet_id'],
                range=range_name
            ).execute()
            
            values = result.get('values', [])
            
            if not values:
                logger.warning(f"No data found in {tab_name} tab")
                return []
            
            # Find header row
            header_row = values[0]
            asin_col = header_row.index('ASIN') if 'ASIN' in header_row else 0
            cerebro_col = header_row.index('Cerebro Data') if 'Cerebro Data' in header_row else 5
            
            asins = []
            for idx, row in enumerate(values[1:], start=2):  # Start from row 2 (1-indexed)
                if len(row) > asin_col and row[asin_col]:
                    # Check if already processed
                    cerebro_status = row[cerebro_col] if len(row) > cerebro_col else ''
                    if cerebro_status and cerebro_status.lower() == 'done':
                        continue
                    
                    asins.append({
                        'asin': row[asin_col].strip(),
                        'row': idx,
                        'cerebro_col': cerebro_col
                    })
            
            logger.info(f"Found {len(asins)} pending ASINs in {tab_name} tab")
            return asins
            
        except HttpError as e:
            logger.error(f"Error reading Google Sheet: {e}")
            return []
    
    def mark_asins_done_batch(self, marketplace: str, row_info_list: List[Dict]):
        """Mark multiple ASINs as done in Google Sheet with batch update"""
        tab_name = SHEET_TABS.get(marketplace)
        if not tab_name or not row_info_list:
            return
        
        try:
            # Build batch update data
            data = []
            for info in row_info_list:
                row = info['row']
                cerebro_col = info['cerebro_col']
                col_letter = chr(65 + cerebro_col)  # 0=A, 1=B, etc.
                range_name = f"{tab_name}!{col_letter}{row}"
                
                data.append({
                    'range': range_name,
                    'values': [['Done']]
                })
            
            body = {
                'valueInputOption': 'RAW',
                'data': data
            }
            
            self.sheets_service.spreadsheets().values().batchUpdate(
                spreadsheetId=self.config['spreadsheet_id'],
                body=body
            ).execute()
            
            logger.info(f"✓ Marked {len(row_info_list)} rows as Done")
            
        except Exception as e:
            logger.error(f"Error marking ASINs done: {e}")
    
    def mark_asins_error_batch(self, marketplace: str, error_info_list: List[Dict]):
        """Mark multiple ASINs as Error in Google Sheet with batch update"""
        tab_name = SHEET_TABS.get(marketplace)
        if not tab_name or not error_info_list:
            return
        
        try:
            # Build batch update data
            data = []
            for info in error_info_list:
                row = info['row']
                cerebro_col = info['cerebro_col']
                comment = info.get('comment', 'No data returned from API')
                
                # Update Cerebro Data column (F) to "Error"
                col_letter = chr(65 + cerebro_col)  # 0=A, 1=B, etc.
                range_name = f"{tab_name}!{col_letter}{row}"
                data.append({
                    'range': range_name,
                    'values': [['Error']]
                })
                
                # Update Comment column (H) with error message
                comment_range = f"{tab_name}!H{row}"
                data.append({
                    'range': comment_range,
                    'values': [[comment]]
                })
            
            body = {
                'valueInputOption': 'RAW',
                'data': data
            }
            
            self.sheets_service.spreadsheets().values().batchUpdate(
                spreadsheetId=self.config['spreadsheet_id'],
                body=body
            ).execute()
            
            logger.info(f"✓ Marked {len(error_info_list)} rows as Error")
            
        except Exception as e:
            logger.error(f"Error marking ASINs as error: {e}")
    
    def mark_asin_done(self, marketplace: str, row: int, cerebro_col: int):
        """Mark ASIN as done in Google Sheet (single update - use batch when possible)"""
        tab_name = SHEET_TABS.get(marketplace)
        if not tab_name:
            return
        
        try:
            # Convert column index to letter
            col_letter = chr(65 + cerebro_col)  # 0=A, 1=B, etc.
            range_name = f"{tab_name}!{col_letter}{row}"
            
            body = {
                'values': [['Done']]
            }
            
            self.sheets_service.spreadsheets().values().update(
                spreadsheetId=self.config['spreadsheet_id'],
                range=range_name,
                valueInputOption='RAW',
                body=body
            ).execute()
            
            logger.info(f"✓ Marked row {row} as Done")
        except HttpError as e:
            logger.error(f"Error updating sheet: {e}")
    
    def check_balance(self) -> Optional[float]:
        """Check API balance"""
        url = 'https://members.helium10.com/api/v1/cerebro/product/report-balance'
        headers = {'Authorization': f'Bearer {self.api_token}'}
        
        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            balance = response.json().get('balance', 0)
            logger.info(f"API Balance: ${balance:.2f}")
            return balance
        except Exception as e:
            logger.error(f"Error checking balance: {e}")
            return None
    
    def create_cerebro_report(self, asins, marketplace_id: str) -> Optional[str]:
        """
        Create a Cerebro report request for single or multiple ASINs
        
        Args:
            asins: Single ASIN string or list of ASINs (up to 10)
            marketplace_id: Amazon marketplace ID
            
        Returns:
            Report ID if successful, None otherwise
        """
        url = f"{API_BASE_URL}/multi-report"
        headers = {
            'Authorization': f'Bearer {self.api_token}',
            'Content-Type': 'application/json'
        }
        
        # Ensure asins is a list
        if isinstance(asins, str):
            asins = [asins]
        
        payload = {
            'marketplace': marketplace_id,
            'asins': asins  # API accepts array of up to 10 ASINs
        }
        
        try:
            response = requests.post(url, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
            
            # The response returns {"results": {"reportId": 1000349}}
            if 'results' in data and 'reportId' in data['results']:
                report_id = str(data['results']['reportId'])
                logger.info(f"✓ Report created: {report_id}")
                return report_id
            else:
                logger.error(f"Failed to create report: {data}")
                return None
                
        except Exception as e:
            logger.error(f"Error creating report: {e}")
            return None
    
    def check_report_status(self, report_id: str) -> Optional[str]:
        """Check report status"""
        url = f"{API_BASE_URL}/report/{report_id}"
        headers = {'Authorization': f'Bearer {self.api_token}'}
        
        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            data = response.json()
            
            # If response is a list, the report is ready (it contains the keywords)
            if isinstance(data, list):
                return "SUCCESS"
            
            # Check for status in various possible formats
            if isinstance(data, dict):
                # Try {"results": {"status": "SUCCESS"}}
                if 'results' in data:
                    if isinstance(data['results'], dict):
                        return data['results'].get('status')
                # Try {"status": "SUCCESS"}
                if 'status' in data:
                    return data.get('status')
            
            return "IN_PROGRESS"
        except Exception as e:
            logger.error(f"Error checking status: {e}")
            return None
    
    def download_report(self, report_id: str, asins: List[str] = None) -> Optional[Dict[str, pd.DataFrame]]:
        """
        Download report data for one or more ASINs
        
        Args:
            report_id: Report ID
            asins: List of ASINs in the report (optional, for validation)
            
        Returns:
            Dictionary mapping ASIN to DataFrame, or None if error
        """
        url = f"{API_BASE_URL}/report/{report_id}"
        headers = {'Authorization': f'Bearer {self.api_token}'}
        
        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            data = response.json()
            
            # API returns array directly, wrap it in dict for consistency
            if isinstance(data, list):
                data_list = data
            elif isinstance(data, dict) and 'data' in data:
                data_list = data.get('data', [])
            elif isinstance(data, dict) and 'results' in data:
                data_list = data.get('results', [])
            else:
                logger.warning(f"Unexpected response format: {type(data)}")
                return None
                
            if not data_list:
                logger.warning("No keywords found in report")
                return None
            
            logger.info(f"✓ Downloaded {len(data_list)} total keyword rows")
            
            # Ensure asins is a list
            if asins is None:
                # Try to detect ASINs from data
                if len(data_list) > 0:
                    first_item = data_list[0]
                    standard_cols = ['phrase', 'searchVolume', 'keyword', 'search_volume']
                    asins = [col for col in first_item.keys() if col not in standard_cols]
            
            if not asins:
                logger.error("Could not identify ASINs in report data")
                return None
            
            # Process data for each ASIN (matching original fetcher logic)
            result = {}
            for asin in asins:
                processed_data = []
                for item in data_list:
                    # Get organic rank for this ASIN (direct key in item)
                    organic_rank = item.get(asin, None)
                    
                    # Only include keywords where this ASIN actually ranks (not null)
                    if organic_rank is not None:
                        keyword = item.get('phrase', item.get('keyword', ''))
                        search_volume = item.get('searchVolume', item.get('search_volume', 0))
                        
                        processed_data.append({
                            'phrase': keyword,
                            'searchVolume': search_volume,
                            asin: organic_rank
                        })
                
                if processed_data:
                    df = pd.DataFrame(processed_data)
                    result[asin] = df
                    logger.info(f"  - {asin}: {len(df)} keywords")
                else:
                    logger.warning(f"  - {asin}: No ranking keywords found")
            
            return result
            
        except Exception as e:
            logger.error(f"Error downloading report: {e}")
            return None
    
    def save_to_bigquery(self, df: pd.DataFrame, asin: str, marketplace: str):
        """
        Save keyword data to BigQuery
        
        Args:
            df: DataFrame with keyword data
            asin: ASIN being processed
            marketplace: Marketplace code (US, UK, CA, etc.)
        """
        try:
            # Prepare data for BigQuery
            df_clean = df.copy()
            
            # Log available columns for debugging
            logger.info(f"API returned columns: {list(df_clean.columns)}")
            
            df_clean['asin'] = asin
            now = datetime.now()
            df_clean['fetch_date'] = now
            df_clean['fetch_month'] = now.strftime('%Y-%m')  # e.g., "2026-01"
            df_clean['fetch_year'] = now.year
            
            # Map API column names to our schema
            # Common variations in Cerebro API response
            columns_map = {
                'Keyword': 'keyword',
                'keyword': 'keyword',
                'Phrase': 'keyword',
                'phrase': 'keyword',
                'Search Volume': 'search_volume',
                'search_volume': 'search_volume',
                'SearchVolume': 'search_volume',
                'searchVolume': 'search_volume',  # camelCase version
                'Organic Rank': 'organic_rank',
                'organic_rank': 'organic_rank',
                'OrganicRank': 'organic_rank',
                'Organic Position': 'organic_rank',
                'organic_position': 'organic_rank',
                asin: 'organic_rank'  # The ASIN column contains the organic rank
            }
            
            # Rename columns that match our mapping
            df_clean = df_clean.rename(columns=columns_map)
            
            # Select only the columns we need for BigQuery
            required_cols = ['asin', 'keyword', 'search_volume', 'organic_rank', 'fetch_date', 'fetch_month', 'fetch_year']
            
            # Check which required columns are present
            available_cols = [col for col in required_cols if col in df_clean.columns]
            
            if 'keyword' not in available_cols:
                logger.error(f"Required 'keyword' column not found. Available after mapping: {list(df_clean.columns)}")
                return
            
            df_output = df_clean[available_cols].copy()
            
            # Get table ID
            table_name = self.config['tables'][marketplace]
            table_id = f"{self.config['project_id']}.{self.config['dataset']}.{table_name}"
            
            # Load to BigQuery
            job_config = bigquery.LoadJobConfig(
                write_disposition=bigquery.WriteDisposition.WRITE_APPEND,
            )
            
            job = self.bigquery_client.load_table_from_dataframe(
                df_output, table_id, job_config=job_config
            )
            job.result()  # Wait for job to complete
            
            logger.info(f"✓ Saved {len(df_output)} rows to BigQuery table {table_name}")
            
        except Exception as e:
            logger.error(f"Error saving to BigQuery: {e}")
            raise
    
    def save_to_bigquery_batch(self, df: pd.DataFrame, marketplace: str):
        """
        Save batch of keyword data to BigQuery (already contains ASIN column)
        
        Args:
            df: Combined DataFrame with keyword data from multiple ASINs
            marketplace: Marketplace code (US, UK, CA, etc.)
        """
        try:
            # The DataFrame already has all data properly formatted from download_report
            # We just need to add the timestamp columns
            df_clean = df.copy()
            
            now = datetime.now()
            df_clean['fetch_date'] = now
            df_clean['fetch_month'] = now.strftime('%Y-%m')  # e.g., "2026-01"
            df_clean['fetch_year'] = now.year
            
            # Map API column names to our schema
            columns_map = {
                'Keyword': 'keyword',
                'keyword': 'keyword',
                'Phrase': 'keyword',
                'phrase': 'keyword',
                'Search Volume': 'search_volume',
                'search_volume': 'search_volume',
                'SearchVolume': 'search_volume',
                'searchVolume': 'search_volume',
                'Organic Rank': 'organic_rank',
                'organic_rank': 'organic_rank',
                'OrganicRank': 'organic_rank',
            }
            
            # Rename columns
            df_clean = df_clean.rename(columns=columns_map)
            
            # Get ASIN column (should be one column that's not a standard field)
            standard_cols = ['phrase', 'searchVolume', 'keyword', 'search_volume', 'fetch_date', 'fetch_month', 'fetch_year']
            asin_cols = [col for col in df_clean.columns if col not in standard_cols]
            
            # Rename ASIN column to organic_rank if found
            if asin_cols:
                # Take the first ASIN column and rename to organic_rank
                for asin_col in asin_cols:
                    if asin_col not in ['asin', 'organic_rank']:
                        df_clean = df_clean.rename(columns={asin_col: 'organic_rank'})
                        break
            
            # Select required columns
            required_cols = ['asin', 'keyword', 'search_volume', 'organic_rank', 'fetch_date', 'fetch_month', 'fetch_year']
            available_cols = [col for col in required_cols if col in df_clean.columns]
            
            df_output = df_clean[available_cols].copy()
            
            # Get table ID
            table_name = self.config['tables'][marketplace]
            table_id = f"{self.config['project_id']}.{self.config['dataset']}.{table_name}"
            
            # Load to BigQuery
            job_config = bigquery.LoadJobConfig(
                write_disposition=bigquery.WriteDisposition.WRITE_APPEND,
            )
            
            job = self.bigquery_client.load_table_from_dataframe(
                df_output, table_id, job_config=job_config
            )
            job.result()  # Wait for job to complete
            
            logger.info(f"✓ Saved {len(df_output)} rows to BigQuery table {table_name}")
            
        except Exception as e:
            logger.error(f"Error saving to BigQuery: {e}")
            raise
    
    def fetch_asin(self, asin: str, marketplace: str, marketplace_id: str, row_info: dict) -> bool:
        """
        Fetch data for a single ASIN and save to BigQuery
        
        Args:
            asin: Amazon ASIN
            marketplace: Marketplace code (US, UK, etc.)
            marketplace_id: Amazon marketplace ID
            row_info: Dict with row number and column info for updating sheet
            
        Returns:
            True if successful, False otherwise
        """
        logger.info(f"\n{'='*60}")
        logger.info(f"Processing: {asin} ({marketplace})")
        logger.info(f"{'='*60}")
        
        # Check balance
        balance = self.check_balance()
        if balance is not None and balance < 1:
            logger.error("Insufficient balance!")
            return False
        
        # Create report
        report_id = self.create_cerebro_report(asin, marketplace_id)
        if not report_id:
            return False
        
        # Wait for report to be ready
        logger.info(f"Waiting {WAIT_FOR_REPORT}s for report to process...")
        time.sleep(WAIT_FOR_REPORT)
        
        # Check status
        for attempt in range(MAX_RETRIES):
            status = self.check_report_status(report_id)
            
            if status in ['SUCCESS', 'completed']:
                logger.info("✓ Report ready!")
                break
            elif status in ['FAILURE', 'failed']:
                logger.error("Report failed!")
                return False
            else:
                logger.info(f"Status: {status} - waiting {RETRY_DELAY}s... (attempt {attempt + 1}/{MAX_RETRIES})")
                time.sleep(RETRY_DELAY)
        else:
            logger.error("Report timed out!")
            return False
        
        # Download report
        df = self.download_report(report_id)
        if df is None or df.empty:
            logger.warning("No data to save")
            return False
        
        # Save to BigQuery
        self.save_to_bigquery(df, asin, marketplace)
        
        # Mark as done in Google Sheet
        self.mark_asin_done(marketplace, row_info['row'], row_info['cerebro_col'])
        
        logger.info(f"✓ Successfully processed {asin}")
        return True
    
    def process_single_batch(self, batch: List[Dict], batch_idx: int, total_batches: int, marketplace: str, marketplace_id: int) -> Dict:
        """
        Process a single batch of ASINs (extracted for parallel processing)
        
        Args:
            batch: List of ASIN items with row info
            batch_idx: Current batch number
            total_batches: Total number of batches
            marketplace: Marketplace code
            marketplace_id: Marketplace ID for API
            
        Returns:
            Dict with success/failure counts and info
        """
        batch_asins = [item['asin'] for item in batch]
        
        logger.info(f"\n{'='*60}")
        logger.info(f"BATCH {batch_idx}/{total_batches}")
        logger.info(f"Processing {len(batch_asins)} ASINs: {', '.join(batch_asins)}")
        logger.info(f"{'='*60}\n")
        
        result = {
            'batch_idx': batch_idx,
            'successful_asins': [],
            'failed_asins': []
        }
        
        try:
            # Create report for batch
            report_id = self.create_cerebro_report(batch_asins, marketplace_id)
            if not report_id:
                logger.error(f"Failed to create report for batch {batch_idx}")
                # Mark all as failed
                for item in batch:
                    result['failed_asins'].append({
                        'row': item['row'],
                        'cerebro_col': item['cerebro_col'],
                        'asin': item['asin'],
                        'comment': 'Failed to create report'
                    })
                return result
            
            # Wait for report to be ready
            logger.info(f"Waiting {WAIT_FOR_REPORT}s for report to process...")
            time.sleep(WAIT_FOR_REPORT)
            
            # Check status
            status = None
            for attempt in range(MAX_RETRIES):
                status = self.check_report_status(report_id)
                
                if status in ['SUCCESS', 'completed']:
                    logger.info("✓ Report ready!")
                    break
                elif status in ['FAILURE', 'failed']:
                    logger.error("Report failed!")
                    break
                else:
                    logger.info(f"Status: {status} - waiting {RETRY_DELAY}s... (attempt {attempt + 1}/{MAX_RETRIES})")
                    time.sleep(RETRY_DELAY)
            else:
                logger.error("Report timed out!")
                status = 'TIMEOUT'
            
            if status in ['FAILURE', 'failed', 'TIMEOUT']:
                # Mark all as failed
                for item in batch:
                    result['failed_asins'].append({
                        'row': item['row'],
                        'cerebro_col': item['cerebro_col'],
                        'asin': item['asin'],
                        'comment': f'Report {status.lower()}'
                    })
                return result
            
            # Download report
            asin_dataframes = self.download_report(report_id, batch_asins)
            if not asin_dataframes:
                logger.error("Failed to download report data")
                # Mark all as failed
                for item in batch:
                    result['failed_asins'].append({
                        'row': item['row'],
                        'cerebro_col': item['cerebro_col'],
                        'asin': item['asin'],
                        'comment': 'Failed to download report'
                    })
                return result
            
            # Process each ASIN's data individually
            for item in batch:
                asin = item['asin']
                df = asin_dataframes.get(asin)
                
                if df is None or df.empty:
                    logger.warning(f"No data for {asin}")
                    result['failed_asins'].append({
                        'row': item['row'],
                        'cerebro_col': item['cerebro_col'],
                        'asin': asin,
                        'comment': 'No data returned from API'
                    })
                    continue
                
                # Save to BigQuery (each ASIN separately)
                self.save_to_bigquery(df, asin, marketplace)
                result['successful_asins'].append(item)
                logger.info(f"✓ Successfully processed {asin}")
            
        except Exception as e:
            logger.error(f"Error processing batch {batch_idx}: {e}")
            # Mark all as failed
            for item in batch:
                if item not in result['successful_asins']:
                    result['failed_asins'].append({
                        'row': item['row'],
                        'cerebro_col': item['cerebro_col'],
                        'asin': item['asin'],
                        'comment': f'Exception: {str(e)[:100]}'
                    })
        
        return result
    
    def fetch_from_google_sheet(self, marketplace: str):
        """
        Main method: Fetch all pending ASINs from Google Sheet
        
        Args:
            marketplace: Marketplace code (US, UK, CA, DE, IT, ES, FR)
        """
        logger.info(f"\n{'='*60}")
        logger.info(f"CEREBRO BIGQUERY FETCHER - {marketplace} MARKETPLACE")
        logger.info(f"{'='*60}\n")
        
        # Get marketplace ID
        marketplace_id = self.config['marketplace_ids'].get(marketplace)
        if not marketplace_id:
            logger.error(f"Invalid marketplace: {marketplace}")
            return
        
        # Get ASINs from sheet
        asins = self.get_asins_from_sheet(marketplace)
        
        if not asins:
            logger.info("No pending ASINs to process")
            return
        
        total = len(asins)
        batch_size = 10  # API supports up to 10 ASINs per request
        parallel_workers = 2  # Process 2 batches in parallel
        total_batches = (total + batch_size - 1) // batch_size
        
        logger.info(f"Found {total} pending ASINs in {marketplace} tab")
        logger.info(f"Processing in {total_batches} batches of up to {batch_size} ASINs")
        logger.info(f"Using {parallel_workers} parallel workers\n")
        
        # Create all batches
        all_batches = []
        for batch_num in range(0, total, batch_size):
            batch = asins[batch_num:batch_num + batch_size]
            batch_idx = batch_num // batch_size + 1
            all_batches.append((batch, batch_idx))
        
        # Process batches in groups of parallel_workers
        for group_start in range(0, len(all_batches), parallel_workers):
            group = all_batches[group_start:group_start + parallel_workers]
            
            # Check balance before starting parallel group
            balance = self.check_balance()
            if balance is not None and balance < 1:
                logger.error("Insufficient balance!")
                break
            
            logger.info(f"\n{'='*60}")
            logger.info(f"PARALLEL GROUP: Processing {len(group)} batches simultaneously")
            logger.info(f"{'='*60}\n")
            
            # Process batches in parallel
            with ThreadPoolExecutor(max_workers=parallel_workers) as executor:
                futures = {}
                
                for batch, batch_idx in group:
                    future = executor.submit(
                        self.process_single_batch,
                        batch,
                        batch_idx,
                        total_batches,
                        marketplace,
                        marketplace_id
                    )
                    futures[future] = batch_idx
                
                # Collect results as they complete
                for future in as_completed(futures):
                    batch_idx = futures[future]
                    try:
                        result = future.result()
                        
                        # Update Google Sheets for successful ASINs
                        if result['successful_asins']:
                            self.mark_asins_done_batch(marketplace, result['successful_asins'])
                        
                        # Update Google Sheets for failed ASINs
                        if result['failed_asins']:
                            self.mark_asins_error_batch(marketplace, result['failed_asins'])
                        
                        logger.info(f"✓ Batch {batch_idx} completed: {len(result['successful_asins'])} success, {len(result['failed_asins'])} failed")
                        
                    except Exception as e:
                        logger.error(f"Error in batch {batch_idx}: {e}")
            
            # Wait between parallel groups (not between individual batches within a group)
            if group_start + parallel_workers < len(all_batches):
                logger.info(f"\nWaiting {DELAY_BETWEEN_REQUESTS}s before next parallel group...")
                time.sleep(DELAY_BETWEEN_REQUESTS)
        
        logger.info(f"\n{'='*60}")
        logger.info(f"COMPLETED - {marketplace} MARKETPLACE")
        logger.info(f"{'='*60}\n")


def main():
    """Main entry point (for testing)"""
    from config import API_TOKEN, BIGQUERY_PROJECT_ID, BIGQUERY_DATASET, BIGQUERY_TABLES, MARKETPLACE_IDS, TRACKING_SPREADSHEET_ID
    
    config = {
        'project_id': BIGQUERY_PROJECT_ID,
        'dataset': BIGQUERY_DATASET,
        'tables': BIGQUERY_TABLES,
        'marketplace_ids': MARKETPLACE_IDS,
        'spreadsheet_id': TRACKING_SPREADSHEET_ID
    }
    
    # Initialize fetcher
    fetcher = CerebroAPIBigQueryFetcher(
        api_token=API_TOKEN,
        credentials_path='google_client_secret.json',
        config=config
    )
    
    # Example: Fetch US marketplace
    fetcher.fetch_from_google_sheet('US')


if __name__ == "__main__":
    main()
