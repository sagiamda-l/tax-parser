from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os
from .parser import parse_file
from .models import SessionLocal, IncomeSummary, ExpenseDetail, init_db

app = FastAPI()

# 모든 출처(Origin)에서의 요청을 허용하도록 설정 (개발 단계)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "./data/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# 서버 시작 시 DB 초기화
init_db()

@app.post("/upload/tax-pdf")
async def handle_upload(file: UploadFile = File(...)):
    # 1. 임시 저장
    save_path = f"./data/uploads/{file.filename}"
    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # 2. 파싱 실행 (추출된 데이터 리스트 확보)
    parsed_results = parse_file(save_path)
    
    # 3. DB 트랜잭션 시작
    db = SessionLocal()
    try:
        for item in parsed_results:
            if item['type'] == 'INCOME':
                obj = IncomeSummary(
                    year=item['year'],
                    company=item['company'],
                    total_salary=item['total_salary'],
                    final_tax=item['final_tax']
                )
            else: # EXPENSE (PDF 간소화 또는 엑셀 카드 내역)
                obj = ExpenseDetail(
                    source="PDF" if file.filename.endswith('pdf') else "EXCEL",
                    category=item.get('category', '기타'),
                    store_name=item.get('store_name', '-'),
                    amount=item['amount']
                )
            db.add(obj)
        db.commit()
        return {"status": "success", "count": len(parsed_results)}
    except Exception as e:
        db.rollback()
        return {"status": "error", "detail": str(e)}
    finally:
        db.close()