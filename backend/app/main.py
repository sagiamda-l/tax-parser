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
    target_year: int = Form(...),
    overwrite: str = Form("false"),
    db: Session = Depends(get_db)
):
    customer_name = parser_engine.extract_customer(file.filename)
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
        new_file = UploadFileRecord(id=new_pk, filename=file.filename, customer=customer_name, target_year=target_year)
        db.add(new_file)

        # 파싱 결과 DB 반영
        for item in parsed_data:
            new_card = CardRecord(
                file_id=new_pk,
                pay_date=item['pay_date'],
                amount=item['amount'],
                vendor=item['vendor'],
                tag=item['tag']
            )
            db.add(new_card)
        
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

    return {"status": "success", "count": len(parsed_data)}

@app.get("/records")
def get_records(year: str, db: Session = Depends(get_db)):
    # 파일 정보와 JOIN하여 문서명(filename)까지 한 번에 가져옴
    results = db.query(CardRecord, UploadFileRecord.filename, UploadFileRecord.customer, UploadFileRecord.target_year).join(
        UploadFileRecord, CardRecord.file_id == UploadFileRecord.id
    ).filter(UploadFileRecord.target_year == year).all()
    
    output = []
    for card, fname, customer, target_year in results:
        card_dict = {c.name: getattr(card, c.name) for c in card.__table__.columns}
        card_dict['filename'] = fname
        card_dict['customer'] = customer
        card_dict['target_year'] = target_year
        output.append(card_dict)
    return output

@app.post("/tags/bulk-save")
async def bulk_save_tags(updates: List[dict], db: Session = Depends(get_db)):
    for item in updates:
        db.query(CardRecord).filter(CardRecord.id == item['id']).update({"tag": item['tag']})
    db.commit()
    return {"status": "ok"}

@app.get("/stats")
def get_stats(year: int = None, db: Session = Depends(get_db)):
    try:
        # 1. 문서별 검증 (이용자명 포함)
        doc_query = db.query(
            UploadFileRecord.filename,
            UploadFileRecord.customer,
            UploadFileRecord.target_year,
            func.count(CardRecord.id).label('count'),
            func.sum(CardRecord.amount).label('total')
        ).join(CardRecord, CardRecord.file_id == UploadFileRecord.id)
        
        if year:
            doc_query = doc_query.filter(UploadFileRecord.target_year == year)
        
        doc_stats = doc_query.group_by(UploadFileRecord.id).all()

        # 2. 항목(태그)별 지출 비율
        tag_query = db.query(
            CardRecord.tag,
            func.sum(CardRecord.amount).label('total')
        ).join(UploadFileRecord, CardRecord.file_id == UploadFileRecord.id)
        
        if year:
            tag_query = tag_query.filter(UploadFileRecord.target_year == year)
            
        tag_stats = tag_query.group_by(CardRecord.tag).all()

        return {
            "documents": [
                {"filename": r[0], "customer": r[1], "target_year": r[2], "count": r[3], "total": float(r[4] or 0)} 
                for r in doc_stats
            ],
            "tags": [
                {"tag": r[0], "total": float(r[1] or 0)} for r in tag_stats
            ]
        }
    except Exception as e:
        # 서버 콘솔에 구체적인 에러를 출력하여 디버깅을 돕습니다.
        print(f"Stats API Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/tags/bulk-vendor-update")
def bulk_update_vendor_tag(vendor: str = Form(...), new_tag: str = Form(...), db: Session = Depends(get_db)):
    try:
        # 가맹점명이 정확히 일치하는 모든 내역의 태그를 변경
        updated_count = db.query(CardRecord).filter(CardRecord.vendor == vendor).update({"tag": new_tag})
        db.commit()
        return {"status": "success", "updated_count": updated_count}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))