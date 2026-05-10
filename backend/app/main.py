from fastapi import FastAPI, UploadFile, File, Depends, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from .database import SessionLocal, init_db, UploadFileRecord, CardRecord
import random, os
from datetime import datetime
from typing import List
from .parser import parser_engine
from sqlalchemy import func

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
    
    if existing:
        if not is_overwrite:
            raise HTTPException(status_code=409, detail="Duplicate file")
        db.delete(existing)
        db.commit()

    # 파일 임시 저장
    temp_path = f"temp_{file.filename}"
    with open(temp_path, "wb") as buffer:
        buffer.write(await file.read())

    try:
        # 파싱 실행
        parsed_data = parser_engine.parse(temp_path, file.filename)
        
        # 신규 PK 생성
        new_pk = datetime.now().strftime('%Y%m%d%H%M%S%f')[:-3] + str(random.randint(10000, 99999))
        new_file = UploadFileRecord(id=new_pk, filename=file.filename, target_year=target_year)
        db.add(new_file)

        # 파싱 결과 DB 반영
        for item in parsed_data:
            new_card = CardRecord(
                file_id=new_pk,
                pay_date=item['pay_date'],
                amount=item['amount'],
                vendor=item['vendor'],
                user=item['user'],
                tag=item['tag']
            )
            db.add(new_card)
        
        db.commit()
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

    return {"status": "success", "count": len(parsed_data)}

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

# 1. 문서별 통계 및 항목별 통계 API
@app.get("/stats")
def get_stats(year: str = "2025", db: Session = Depends(get_db)):
    # 문서별 통계
    doc_stats = db.query(
        CardRecord.filename,
        func.count(CardRecord.id).label('count'),
        func.sum(CardRecord.amount).label('total')
    ).group_by(CardRecord.filename).all()

    # 항목(태그)별 통계
    tag_stats = db.query(
        CardRecord.tag,
        func.count(CardRecord.id).label('count'),
        func.sum(CardRecord.amount).label('total')
    ).group_by(CardRecord.tag).all()

    return {
        "documents": [dict(row) for row in doc_stats],
        "tags": [dict(row) for row in tag_stats]
    }

# 2. 동일 가맹점 태그 일괄 변경 API
@app.post("/tags/bulk-vendor-update")
def bulk_update_vendor_tag(vendor: str = Form(...), new_tag: str = Form(...), db: Session = Depends(get_db)):
    try:
        updated_count = db.query(CardRecord).filter(CardRecord.vendor == vendor).update({"tag": new_tag})
        db.commit()
        return {"status": "success", "updated_count": updated_count}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))