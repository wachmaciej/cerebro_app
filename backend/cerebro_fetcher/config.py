"""
Central Configuration for Cerebro API Data Fetcher with BigQuery
Update the API_TOKEN and BIGQUERY settings here
"""

import os

# Helium10 Cerebro API Token
# Get a new token from: https://members.helium10.com/ > Account > API Settings
API_TOKEN = os.getenv('HELIUM10_API_TOKEN', 'Hsjh33IPek9btUn1DeC-4vfc-Eq1ZXeOXX6PdZf_6OBXCg3Uam_QvdWn9dKF5iO9a8d80b22bddc436f16a126123a6d605d')

# Google Sheets Configuration (for reading ASINs)
TRACKING_SPREADSHEET_ID = os.getenv('TRACKING_SPREADSHEET_ID', '1Ijm_oyxJTlA0U30oqI2AZV9LMTH67WxVBNKidPU22ho')

# BigQuery Configuration
BIGQUERY_PROJECT_ID = os.getenv('BIGQUERY_PROJECT_ID', 'morpheus-sql-database')  # Your Google Cloud Project ID
BIGQUERY_DATASET = os.getenv('BIGQUERY_DATASET', 'cerebro_data')  # Dataset name (will be created if doesn't exist)

# BigQuery Table Names for each marketplace
BIGQUERY_TABLES = {
    'US': 'us_keywords',
    'UK': 'uk_keywords',
    'CA': 'ca_keywords',
    'DE': 'de_keywords',
    'IT': 'it_keywords',
    'ES': 'es_keywords',
    'FR': 'fr_keywords'
}

# Marketplace IDs
MARKETPLACE_IDS = {
    'US': 'ATVPDKIKX0DER',
    'UK': 'A1F83G8C2ARO7P',
    'CA': 'A2EUQ1WTGCTBG2',
    'DE': 'A1PA6795UKMFR9',
    'IT': 'APJ6JRA9NG5V4',  # Italy
    'ES': 'A1RKKUPIHCS9HS',  # Spain
    'FR': 'A13V1IB3VIYZZH'  # France
}
