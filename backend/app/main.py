from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import shutil, os
from .parser import parse_file
from .services.card_parsers import parse_card_excel
from .services.pdf_parsers import parse_tax_pdf
from .classifier import assign_tag # 업체명 기반 태깅 함수
from .database import SessionLocal, CardRecord, DocumentRecord, init_db

BUILD_DATE = os.getenv("APP_BUILD_DATE", "No Build Date Found")

@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"🚀 [SERVER STARTUP] BUILD_DATE: {BUILD_DATE}")
    print(f"📂 BASEDIR: {os.getcwd()}")
    yield
    print("👋 [SERVER SHUTDOWN] Goodbye!")

app = FastAPI(lifespan=lifespan)

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

@app.post("/upload")
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

# [기능 1] 특정 연도 데이터 존재 여부 확인 (중복 체크)
@app.get("/check-exists/{year}")
async def check_year_data(year: str):
    db = SessionLocal()
    # CardRecord의 pay_date(문자열)에서 연도 추출 비교
    exists = db.query(CardRecord).filter(CardRecord.pay_date.contains(year)).first() is not None
    db.close()
    return {"exists": exists}

# [기능 2] 데이터 조회 및 필터링
@app.get("/records")
async def get_records(year: str = None, tag: str = None):
    db = SessionLocal()
    query = db.query(CardRecord)
    if year: query = query.filter(CardRecord.pay_date.contains(year))
    if tag: query = query.filter(CardRecord.tag == tag)
    
    # PDF 데이터(DocumentRecord)도 함께 가져와서 병합하거나 따로 제공
    cards = query.all()
    docs = db.query(DocumentRecord).all() # 연도 필터링 로직 추가 필요
    db.close()
    return {"cards": cards, "documents": docs}

# [기능 3] 대상 연도 자료 삭제
@app.delete("/records/{year}")
async def delete_year_data(year: str):
    db = SessionLocal()
    db.query(CardRecord).filter(CardRecord.pay_date.contains(year)).delete(synchronize_session=False)
    db.commit()
    db.close()
    return {"message": f"{year}년도 데이터가 삭제되었습니다."}

@app.post("/save-tags")
async def save_tags(updates: list):
    db = SessionLocal()
    for item in updates:
        if item['type'] == 'card':
            db.query(CardRecord).filter(CardRecord.id == item['id']).update({"tag": item['tag']})
        else:
            db.query(DocumentRecord).filter(DocumentRecord.id == item['id']).update({"tag": item['tag']})
    db.commit()
    db.close()
    return {"message": "저장 완료"}