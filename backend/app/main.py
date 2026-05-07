from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import shutil, os
from .parser import parse_file
from .services.card_parsers import parse_card_excel
from .services.pdf_parsers import parse_tax_pdf
from .classifier import assign_tag # 업체명 기반 태깅 함수
from .database import SessionLocal, CardRecord, DocumentRecord, init_db

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
async def handle_upload(file: UploadFile = File(...), overwrite: bool = False):
    # 1. 임시 저장
    file_path = f"./data/uploads/{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # 2. 파싱 실행 (추출된 데이터 리스트 확보)
    parsed_results = parse_file(file_path)
    
    db = SessionLocal()
    try:
        # 파일 형식에 따른 파싱
        if file.filename.endswith(('.xlsx', '.xls')):
            data = parse_card_excel(file_path)
            for item in data:
                # 덮어쓰기 로직 (날짜, 업체, 금액이 같으면 중복으로 간주 가능)
                item['tag'] = assign_tag(item['vendor'])
                db.add(CardRecord(**item))
        else:
            data = parse_tax_pdf(file_path)
            for item in data:
                db.add(DocumentRecord(**item))
        
        db.commit()
        return {"message": "업로드 및 파싱 완료", "count": len(data)}
    finally:
        db.close()

@app.get("/records")
async def get_records(year: str = None, category: str = None):
    db = SessionLocal()
    # 연도별, 분류별 필터링 쿼리 작성 (Frontend 4번 항목 대응)
    # ... 쿼리 로직 ...
    return {"data": "필터링된 결과"}