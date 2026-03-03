"""
BigQuery Setup Script
Creates dataset and tables for Cerebro data
Run this once before using the fetcher for the first time
"""

from google.cloud import bigquery
from google.oauth2 import service_account
from config import BIGQUERY_PROJECT_ID, BIGQUERY_DATASET, BIGQUERY_TABLES

def create_bigquery_tables():
    """Create BigQuery dataset and tables for all marketplaces"""
    
    print(f"\n{'='*60}")
    print("BIGQUERY SETUP - CREATING DATASET AND TABLES")
    print(f"{'='*60}\n")
    
    # Initialize BigQuery client
    client = bigquery.Client(project=BIGQUERY_PROJECT_ID)
    print(f"✓ Connected to project: {BIGQUERY_PROJECT_ID}")
    
    # Create dataset
    dataset_id = f"{BIGQUERY_PROJECT_ID}.{BIGQUERY_DATASET}"
    
    try:
        client.get_dataset(dataset_id)
        print(f"✓ Dataset '{BIGQUERY_DATASET}' already exists")
    except Exception:
        dataset = bigquery.Dataset(dataset_id)
        dataset.location = "europe-west2"  # London
        dataset = client.create_dataset(dataset, timeout=30)
        print(f"✓ Created dataset '{BIGQUERY_DATASET}' in europe-west2 (London)")
    
    # Define schema
    schema = [
        bigquery.SchemaField("asin", "STRING", mode="REQUIRED", description="Amazon ASIN"),
        bigquery.SchemaField("keyword", "STRING", mode="REQUIRED", description="Search keyword"),
        bigquery.SchemaField("search_volume", "INTEGER", mode="NULLABLE", description="Monthly search volume"),
        bigquery.SchemaField("organic_rank", "INTEGER", mode="NULLABLE", description="Organic ranking position"),
        bigquery.SchemaField("fetch_date", "TIMESTAMP", mode="REQUIRED", description="Timestamp when data was fetched"),
        bigquery.SchemaField("fetch_month", "STRING", mode="REQUIRED", description="Month when data was fetched (YYYY-MM format)"),
        bigquery.SchemaField("fetch_year", "INTEGER", mode="REQUIRED", description="Year when data was fetched"),
    ]
    
    # Create tables for all marketplaces
    print(f"\nCreating tables...")
    for marketplace, table_name in BIGQUERY_TABLES.items():
        table_id = f"{BIGQUERY_PROJECT_ID}.{BIGQUERY_DATASET}.{table_name}"
        
        try:
            client.get_table(table_id)
            print(f"  ✓ {marketplace}: Table '{table_name}' already exists")
        except Exception:
            table = bigquery.Table(table_id, schema=schema)
            
            # Enable partitioning by date for better query performance and cost
            table.time_partitioning = bigquery.TimePartitioning(
                type_=bigquery.TimePartitioningType.DAY,
                field="fetch_date"
            )
            
            # Add clustering for better query performance
            table.clustering_fields = ["fetch_month", "fetch_year", "asin"]
            
            # Set table description
            table.description = f"Cerebro keyword data for {marketplace} marketplace"
            
            table = client.create_table(table)
            print(f"  ✓ {marketplace}: Created table '{table_name}'")
    
    print(f"\n{'='*60}")
    print("SETUP COMPLETE!")
    print(f"{'='*60}\n")
    print(f"Dataset: {BIGQUERY_DATASET}")
    print(f"Tables created: {len(BIGQUERY_TABLES)}")
    print(f"\nYou can now run the fetcher scripts to populate the tables.")
    print(f"\nExample queries:")
    print(f"  # View all data for an ASIN:")
    print(f"  SELECT * FROM `{BIGQUERY_PROJECT_ID}.{BIGQUERY_DATASET}.us_keywords`")
    print(f"  WHERE asin = 'B0ABCD1234'")
    print(f"  ORDER BY search_volume DESC")
    print(f"\n  # Get monthly summary:")
    print(f"  SELECT fetch_month, COUNT(*) as keyword_count, AVG(search_volume) as avg_volume")
    print(f"  FROM `{BIGQUERY_PROJECT_ID}.{BIGQUERY_DATASET}.us_keywords`")
    print(f"  GROUP BY fetch_month")
    print(f"  ORDER BY fetch_month DESC")
    print()


if __name__ == "__main__":
    try:
        create_bigquery_tables()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        print("\nMake sure you have:")
        print("  1. Set BIGQUERY_PROJECT_ID in config.py")
        print("  2. Authenticated with BigQuery:")
        print("     - Service account: Set GOOGLE_APPLICATION_CREDENTIALS env var")
        print("     - Or run: gcloud auth application-default login")
