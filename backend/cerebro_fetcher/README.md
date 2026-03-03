# Cerebro API Data Fetcher with BigQuery

Fetches keyword data from Helium10 Cerebro API for Amazon ASINs and stores the results in **Google BigQuery** instead of Google Sheets or Drive.

## Features

- ✅ **Google Sheets Integration** - Reads ASINs from your tracking sheet
- ✅ **BigQuery Storage** - Stores all keyword data in BigQuery tables
- ✅ **Auto Status Updates** - Marks "Cerebro Data" column as "Done" after fetching
- ✅ **Skips Completed ASINs** - Won't re-fetch already processed ASINs
- ✅ **Auto Table Creation** - Creates BigQuery dataset and tables automatically
- ✅ **Partitioned Tables** - Tables partitioned by date for efficient queries
- ✅ Supports US, UK, CA, DE, IT, ES, and FR marketplaces
- ✅ Automatic rate limiting (20-second delays between requests)
- ✅ Retry logic for failed requests
- ✅ Balance checking before requests

## Google Sheet Structure

Your Google Sheet: `https://docs.google.com/spreadsheets/d/1Ijm_oyxJTlA0U30oqI2AZV9LMTH67WxVBNKidPU22ho/edit`

**Required Tabs:** US, UK, CA, DE, IT, ES, FR

**Columns:**
| Column | Description |
|--------|-------------|
| ASIN | Amazon ASIN to fetch |
| Run Reports | (ignored by script) |
| Send Analysis | (ignored by script) |
| Emails to send reports | (ignored by script) |
| Marketplace | (ignored by script) |
| **Cerebro Data** | Script marks as "Done" after successful fetch |
| Send Analysis Email | (ignored by script) |
| Comment | (ignored by script) |

## BigQuery Schema

Each marketplace has its own table with the following schema:

| Column | Type | Description |
|--------|------|-------------|
| asin | STRING | Amazon ASIN |
| keyword | STRING | Search keyword |
| search_volume | INTEGER | Monthly search volume |
| organic_rank | INTEGER | Organic ranking position |
| sponsored_rank | INTEGER | Sponsored ranking position |
| title_density | INTEGER | Keyword density in title |
| fetch_date | TIMESTAMP | Exact timestamp when data was fetched |
| fetch_month | STRING | Month when fetched (YYYY-MM format, e.g., "2026-01") |
| fetch_year | INTEGER | Year when fetched |
| marketplace | STRING | Marketplace code (US, UK, etc.) |

Tables are:
- **Partitioned** by `fetch_date` for efficient querying and cost optimization
- **Clustered** by `marketplace`, `fetch_month`, and `asin` for faster queries

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure Google Cloud Project

#### Create a GCP Project (if you don't have one)
1. Go to https://console.cloud.google.com
2. Create a new project or select an existing one
3. Note your **Project ID**

#### Enable APIs
1. Enable **BigQuery API**
2. Enable **Google Sheets API**

#### Set up Authentication

**Option A: Service Account (Recommended for Production)**
1. Go to IAM & Admin > Service Accounts
2. Create a new service account
3. Grant roles:
   - BigQuery Data Editor
   - BigQuery Job User
4. Create and download JSON key
5. Set environment variable:
   ```bash
   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\service-account-key.json"
   ```

**Option B: Application Default Credentials (For Testing)**
```bash
gcloud auth application-default login
```

### 3. Configure Google Sheets OAuth

1. In Google Cloud Console, go to APIs & Services > Credentials
2. Create OAuth 2.0 Client ID (Desktop app)
3. Download and save as `google_client_secret.json` in the project root
4. First run will open browser for authentication

### 4. Update Configuration

Edit `config.py`:

```python
# Your Helium10 API token
API_TOKEN = 'your_helium10_token_here'

# Your Google Cloud Project ID
BIGQUERY_PROJECT_ID = 'your-gcp-project-id'

# BigQuery dataset name (will be created automatically)
BIGQUERY_DATASET = 'cerebro_data'
```

### 5. Create BigQuery Tables

Run the setup script to create the dataset and tables:

```bash
python setup_bigquery.py
```

This will create:
- Dataset: `cerebro_data`
- Tables: `us_keywords`, `uk_keywords`, `ca_keywords`, `de_keywords`, `it_keywords`, `es_keywords`, `fr_keywords`

## Usage

### Process a Specific Marketplace

Navigate to the marketplace folder and run the script:

```bash
# US Marketplace
cd US
python fetch_us_cerebro_data.py

# UK Marketplace
cd UK
python fetch_uk_cerebro_data.py

# CA Marketplace
cd CA
python fetch_ca_cerebro_data.py

# Germany
cd DE
python fetch_de_cerebro_data.py

# Italy
cd IT
python fetch_it_cerebro_data.py

# Spain
cd ES
python fetch_es_cerebro_data.py

# France
cd FR
python fetch_fr_cerebro_data.py
```

### What Happens When You Run It

1. **Authenticates** with Google Sheets (first run opens browser)
2. **Connects** to BigQuery and creates dataset/tables if needed
3. **Reads ASINs** from the marketplace tab in your Google Sheet
4. **Skips** any ASINs already marked as "Done"
5. **Fetches** keyword data from Helium10 Cerebro API for each ASIN
6. **Saves** data to BigQuery table
7. **Marks** "Cerebro Data" column as "Done" in the tracking sheet
8. **Waits** 20 seconds between ASINs to respect API rate limits

## Querying Data in BigQuery

### Example Queries

**Get all keywords for a specific ASIN:**
```sql
SELECT keyword, search_volume, organic_rank, sponsored_rank
FROM `your-project-id.cerebro_data.us_keywords`
WHERE asin = 'B0ABCD1234'
ORDER BY search_volume DESC
```

**Get top keywords by search volume:**
```sql
SELECT keyword, search_volume, COUNT(DISTINCT asin) as asin_count
FROM `your-project-id.cerebro_data.us_keywords`
WHERE fetch_month = '2026-01'  -- January 2026
GROUP BY keyword, search_volume
ORDER BY search_volume DESC
LIMIT 100
```

**Get monthly trends:**
```sql
SELECT fetch_month, fetch_month, COUNT(*) as keyword_count, AVG(search_volume) as avg_volume
FROM (
  SELECT * FROM `your-project-id.cerebro_data.us_keywords`
  UNION ALL
  SELECT * FROM `your-project-id.cerebro_data.uk_keywords`
  UNION ALL
  SELECT * FROM `your-project-id.cerebro_data.ca_keywords`
)
WHERE fetch_year = 2026
GROUP BY marketplace, fetch_month
ORDER BY fetch_month DESC,
  SELECT * FROM `your-project-id.cerebro_data.us_keywords`
  UNION ALL
  SELECT * FROM `your-project-id.cerebro_data.uk_keywords`
  UNION ALL
  SELECT * FROM `your-project-id.cerebro_data.ca_keywords`
)
WHERE fetch_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY marketplace
```

## BigQuery Tables

The script automatically creates the following tables:

- `cerebro_data.us_keywords` - US marketplace
- `cerebro_data.uk_keywords` - UK marketplace
- `cerebro_data.ca_keywords` - Canada marketplace
- `cerebro_data.de_keywords` - Germany marketplace
- `cerebro_data.it_keywords` - Italy marketplace
- `cerebro_data.es_keywords` - Spain marketplace
- `cerebro_data.fr_keywords` - France marketplace

## File Structure

```
Cerebro API Big Query/
├── config.py                           # Configuration (API token, BigQuery settings)
├── setup_bigquery.py                   # Setup script to create tables
├── requirements.txt                    # Python dependencies
├── README.md                           # This file
├── requirements.txt                    # Python dependencies
├── google_client_secret.json          # Google OAuth credentials (you provide)
├── token.pickle                        # Auto-generated auth token
├── cerebro_bigquery_fetcher.log       # Log file
├── US/
│   └── fetch_us_cerebro_data.py
├── UK/
│   └── fetch_uk_cerebro_data.py
├── CA/
│   └── fetch_ca_cerebro_data.py
├── DE/
│   └── fetch_de_cerebro_data.py
├── IT/
│   └── fetch_it_cerebro_data.py
├── ES/
│   └── fetch_es_cerebro_data.py
└── FR/
    └── fetch_fr_cerebro_data.py
```

## Troubleshooting

### "Permission denied" errors
- Make sure your service account has BigQuery Data Editor and BigQuery Job User roles
- Or ensure you've run `gcloud auth application-default login`

### "Dataset not found"
- The script creates the dataset automatically on first run
- Check that `BIGQUERY_PROJECT_ID` in config.py matches your GCP project

### "Google Sheets API error"
- Make sure you've downloaded `google_client_secret.json`
- First run should open browser for OAuth authentication
- Token is saved in `token.pickle` for future runs

### "API balance too low"
- Check your Helium10 account balance
- Script checks balance before each ASIN fetch

## Cost Considerations

### BigQuery Costs
- **Storage**: First 10 GB per month is free, then ~$0.02/GB
- **Queries**: First 1 TB per month is free, then ~$5/TB
- **Loading data**: Free

For typical usage (thousands of keywords per month), costs should be minimal or within the free tier.

## Differences from Google Sheets Version

| Feature | Google Sheets Version | BigQuery Version |
|---------|----------------------|------------------|
| Data Storage | Google Drive folders (Excel files) | BigQuery tables |
| Scalability | Limited by Drive quotas | Handles millions of rows |
| Querying | Manual (open Excel files) | SQL queries |
| Historical Data | Separate files per ASIN | All in one table with timestamps |
| Integration | Manual export/import | Direct API/BI tool access |
| Cost | Free | Free tier + usage costs |

## License

MIT
