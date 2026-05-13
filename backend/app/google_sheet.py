import os
import gspread
from google.oauth2.service_account import Credentials
import sqlite3

class GoogleSheetsManager:
    def __init__(self, db_folder_path: str):
        # 환경 변수 및 경로 설정
        self.sheet_id = os.getenv('SPREADSHEET_ID')
        self.creds_path = os.path.join(db_folder_path, 'credentials.json')
        self.scopes = [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive'
        ]
        
    def _get_client(self):
        if not os.path.exists(self.creds_path):
            raise FileNotFoundError(f"인증 파일이 없습니다: {self.creds_path}")
        
        creds = Credentials.from_service_account_file(self.creds_path, scopes=self.scopes)
        return gspread.authorize(creds)

    def sync_sqlite_to_sheets(self, db_path: str, year: str):
        try:
            client = self._get_client()
            if not self.sheet_id:
                return {"status": "error", "message": "SPREADSHEET_ID 환경 변수가 설정되지 않았습니다."}
            
            spreadsheet = client.open_by_key(self.sheet_id)
            sheet_name = f"{year}년 결산"

            # 1. 시트 확인 및 생성
            try:
                worksheet = spreadsheet.worksheet(sheet_name)
            except gspread.exceptions.WorksheetNotFound:
                worksheet = spreadsheet.add_worksheet(title=sheet_name, rows="1000", cols="10")

            # 2. SQLite 데이터 추출
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            query = """
                SELECT pay_date, customer, vendor, amount, tag 
                FROM records 
                WHERE strftime('%Y', pay_date) = ? 
                ORDER BY pay_date ASC
            """
            cursor.execute(query, (year,))
            rows = cursor.fetchall()
            conn.close()

            # 3. 데이터 준비 및 전송
            header = ["날짜", "이용자", "가맹점", "금액", "태그"]
            data_to_sync = [header] + [list(row) for row in rows]

            worksheet.clear()
            worksheet.update('A1', data_to_sync)
            
            return {"status": "success", "count": len(rows), "sheet_name": sheet_name}
            
        except Exception as e:
            return {"status": "error", "message": str(e)}