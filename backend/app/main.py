from fastapi import FastAPI, UploadFile, File, Depends, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from .database import SessionLocal, init_db, UploadFileRecord, CardRecord, DocumentRecord
import random, os
from datetime import datetime
from typing import List

app = FastAPI()
init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # 보안 환경에 따라 특정 IP로 제한 가능
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

@app.post("/upload")
async def handle_upload(
    file: UploadFile = File(...), 
    overwrite: bool = Form(False),
    db: Session = Depends(get_db)
):
    existing = db.query(UploadFileRecord).filter(UploadFileRecord.filename == file.filename).first()
    
    if existing:
        if not overwrite:
            raise HTTPException(status_code=409, detail="Duplicate filename")
        db.delete(existing)
        db.commit()

    # PK 생성: 연월일시분초밀리초(17자) + 랜덤5자
    new_pk = datetime.now().strftime('%Y%m%d%H%M%S%f')[:-3] + str(random.randint(10000, 99999))
    
    # [임시 파싱 로직 - 실제 parser.py 호출로 대체]
    new_file = UploadFileRecord(id=new_pk, filename=file.filename, target_year="2025", doc_type="Card")
    db.add(new_file)
    
    # 예시 데이터 생성
    sample_card = CardRecord(file_id=new_pk, pay_date="2025-05-08", amount=50000.0, vendor="식당", user="이성렬", tag="식비")
    db.add(sample_card)
    
    db.commit()
    return {"status": "success", "file_id": new_pk}

@app.get("/records")
def get_records(year: str, db: Session = Depends(get_db)):
    cards = db.query(CardRecord).join(UploadFileRecord).filter(UploadFileRecord.target_year == year).all()
    return {"cards": cards}

@app.post("/tags/bulk-update")
async def bulk_update(updates: List[dict], db: Session = Depends(get_db)):
    for item in updates:
        db.query(CardRecord).filter(CardRecord.id == item['id']).update({"tag": item['tag']})
    db.commit()
    return {"message": "Success"}