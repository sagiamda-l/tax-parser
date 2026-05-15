import os
import gspread
from google.oauth2.service_account import Credentials
import sqlite3
import time
import random
import traceback  # 파일 최상단 import 문에 추가

class GoogleSheetsManager:
    def __init__(self, db_folder_path: str):
        self.sheet_id = os.getenv('SPREADSHEET_ID')
        self.creds_path = os.path.join(db_folder_path, 'credentials.json')
        self.scopes = [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive'
        ]
        
    def _get_client(self):
        if not os.path.exists(self.creds_path):
            raise FileNotFoundError(f"인증 키 파일이 없습니다: {self.creds_path}")
        creds = Credentials.from_service_account_file(self.creds_path, scopes=self.scopes)
        return gspread.authorize(creds)

    def sync_sqlite_to_sheets(self, db_path: str, year: str):
        """
        API 제한 방지를 위해 최대 3회 재시도(지수 백오프) 로직을 적용한 동기화 기능
        """
        max_retries = 3
        backoff_factor = 2
        
        for attempt in range(max_retries):
            try:
                client = self._get_client()
                if not self.sheet_id:
                    return {"status": "error", "message": "SPREADSHEET_ID 환경 변수가 없습니다."}
                
                spreadsheet = client.open_by_key(self.sheet_id)
                sheet_name = f"{year}년 결산"

                try:
                    worksheet = spreadsheet.worksheet(sheet_name)
                except gspread.exceptions.WorksheetNotFound:
                    worksheet = spreadsheet.add_worksheet(title=sheet_name, rows="1000", cols="10")

                # SQLite 데이터 추출
                conn = sqlite3.connect(db_path)
                cursor = conn.cursor()
                query = """
                    SELECT b.pay_date, a.customer, b.vendor, b.amount, a.filename, b.tag 
                    FROM upload_files a, card_records b
                    WHERE a.id = b.upload_file_id
                    AND a.target_year = ? 
                    ORDER BY b.pay_date ASC
                """
                cursor.execute(query, (year,))
                rows = cursor.fetchall()
                conn.close()

                header = ["날짜", "이용자", "가맹점", "금액", "파일명", "태그"]
                data_to_sync = [header] + [list(row) for row in rows]

                # 단 2번의 대량 전송(Batch Call)으로 API 사용 최소화
                worksheet.clear()
                worksheet.update('A1', data_to_sync)
                
                return {"status": "success", "count": len(rows), "sheet_name": sheet_name}

            except gspread.exceptions.APIError as api_err:
                traceback.print_exc() # 도커 터미널에 에러 출력
                if api_err.response.status_code == 429 and attempt < max_retries - 1:
                    sleep_time = (backoff_factor ** attempt) + random.uniform(0, 1)
                    time.sleep(sleep_time)
                    continue
                return {"status": "error", "message": f"Google API 오류: {str(api_err)}"}
                
            except Exception as e:
                traceback.print_exc() # 도커 터미널에 에러 출력 (이게 있어야 로그에 찍힙니다)
                # str(e)가 비어있을 경우를 대비해 에러 타입 이름(예: OperationalError)을 반환하도록 보완
                error_msg = str(e).strip() or f"Unknown Internal Error ({type(e).__name__})"
                return {"status": "error", "message": error_msg}