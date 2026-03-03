"""
One-time migration script to move ASINs from Google Sheets to the PostgreSQL Database
"""
import os
import pickle
from googleapiclient.discovery import build
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow

import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
import models
from cerebro_fetcher.config import TRACKING_SPREADSHEET_ID
from cerebro_fetcher.cerebro_bigquery_fetcher import SHEET_TABS

SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

def main():
    creds = None
    token_path = os.path.join(os.path.dirname(__file__), 'cerebro_fetcher', 'token.pickle')
    credentials_path = os.path.join(os.path.dirname(__file__), 'cerebro_fetcher', 'morpheus-cerebro-big-query.json')
    
    if os.path.exists(token_path):
        with open(token_path, 'rb') as token:
            creds = pickle.load(token)
            
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(credentials_path, SCOPES)
            creds = flow.run_local_server(port=0)
            with open(token_path, 'wb') as token:
                pickle.dump(creds, token)
            
    try:
        sheets_service = build('sheets', 'v4', credentials=creds)
    except Exception as e:
        print(f"Failed to build sheets service: {e}")
        return
        
    db = SessionLocal()
    
    total_added = 0
    for marketplace, tab_name in SHEET_TABS.items():
        print(f"Fetching ASINs for {marketplace}...")
        try:
            range_name = f"{tab_name}!A:H"
            result = sheets_service.spreadsheets().values().get(
                spreadsheetId=TRACKING_SPREADSHEET_ID,
                range=range_name
            ).execute()
            
            values = result.get('values', [])
            if not values:
                continue
                
            header_row = values[0]
            asin_col = header_row.index('ASIN') if 'ASIN' in header_row else 0
            
            # Optionally check if we want to copy all or just non-done
            # We'll copy ALL ASINs so the DB is complete.
            
            for idx, row in enumerate(values[1:], start=2):
                if len(row) > asin_col and row[asin_col]:
                    asin_str = row[asin_col].strip()
                    if not asin_str:
                        continue
                        
                    # Check if exists
                    existing = db.query(models.AsinTrack).filter(
                        models.AsinTrack.asin == asin_str, 
                        models.AsinTrack.marketplace == marketplace
                    ).first()
                    
                    if not existing:
                        new_asin = models.AsinTrack(
                            asin=asin_str,
                            marketplace=marketplace,
                            tags=f"imported_from_sheet" 
                        )
                        db.add(new_asin)
                        total_added += 1
                        
            db.commit()
            print(f"Successfully processed {marketplace}")
        except Exception as e:
            print(f"Error on {marketplace}: {e}")
            
    print(f"Migration complete. Added {total_added} ASINs.")

if __name__ == "__main__":
    main()
