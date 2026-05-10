from fastapi import FastAPI, UploadFile, File, Depends, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from .database import SessionLocal, init_db, UploadFileRecord, CardRecord
import random, os
from datetime import datetime
from typing import List

app = FastAPI()
init_db()

# CORS 설정: 프론트엔드 통신 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
    target_year: str = Form("2025"),
    overwrite: str = Form("false"),
    db: Session = Depends(get_db)
):
    is_overwrite = overwrite.lower() == "true"
    existing = db.query(UploadFileRecord).filter(UploadFileRecord.filename == file.filename).first()
    
    # 1. 중복 체크 로직
    if existing:
        if not is_overwrite:
            raise HTTPException(status_code=409, detail="File already exists")
        db.delete(existing) # 기존 레코드 및 하위 카드내역 Cascade 삭제
        db.commit()

    # 2. 신규 PK 생성 규칙 (README.md 준수)
    new_pk = datetime.now().strftime('%Y%m%d%H%M%S%f')[:-3] + str(random.randint(10000, 99999))
    
    # 3. 파일 레코드 생성
    new_file = UploadFileRecord(id=new_pk, filename=file.filename, target_year=target_year)
    db.add(new_file)

    # 4. 파싱 데이터 생성 (이 부분은 parser.py의 실제 로직으로 연결)
    # 다른 파일을 올렸을 때 다른 데이터가 보이도록 테스트용 랜덤 데이터 생성
    for i in range(random.randint(3, 8)):
        new_card = CardRecord(
            file_id=new_pk,
            pay_date=f"{target_year}-05-{random.randint(1, 30):02d}",
            amount=random.randint(10, 500) * 100,
            vendor=f"상호명_{random.randint(100, 999)}",
            user="이성렬" if i % 2 == 0 else "가족", # 실제 환경에선 파일에서 추출
            tag="기타"
        )
        db.add(new_card)
    
    db.commit()
    return {"status": "success", "file_id": new_pk}

@app.get("/records")
def get_records(year: str, db: Session = Depends(get_db)):
    # 파일 정보와 JOIN하여 문서명(filename)까지 한 번에 가져옴
    results = db.query(CardRecord, UploadFileRecord.filename).join(
        UploadFileRecord, CardRecord.file_id == UploadFileRecord.id
    ).filter(UploadFileRecord.target_year == year).all()
    
    output = []
    for card, fname in results:
        card_dict = {c.name: getattr(card, c.name) for c in card.__table__.columns}
        card_dict['filename'] = fname
        output.append(card_dict)
    return output

@app.post("/tags/bulk-save")
async def bulk_save_tags(updates: List[dict], db: Session = Depends(get_db)):
    for item in updates:
        db.query(CardRecord).filter(CardRecord.id == item['id']).update({"tag": item['tag']})
    db.commit()
    return {"status": "ok"}