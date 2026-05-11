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

@app.get("/stats")
def get_stats(year: str = "2025", db: Session = Depends(get_db)):
    try:
        # 1. 문서별 통계 (file_id 또는 filename 사용)
        # 사용자님이 CardRecord.file_id로 변경하셨으므로 이를 반영합니다.
        # 만약 화면에 파일명을 표시해야 한다면, 저장 시 filename 컬럼도 모델에 정의되어 있어야 합니다.
        #
        doc_stats = db.query(
            UploadFileRecord.filename,
            UploadFileRecord.customer,
            func.count(CardRecord.id).label('count'),
            func.sum(CardRecord.amount).label('total')
            ).join(CardRecord, CardRecord.file_id == UploadFileRecord.id
                   ).group_by(UploadFileRecord.id, UploadFileRecord.filename, UploadFileRecord.customer).all()

        # 2. 항목(태그)별 통계
        tag_stats = db.query(
            CardRecord.tag,
            func.count(CardRecord.id).label('count'),
            func.sum(CardRecord.amount).label('total')
        ).group_by(CardRecord.tag).all()

        # [핵심 수정]: ValueError 방지를 위한 명시적 매핑
        return {
            "documents": [
                {
                    "filename": str(row[0]),  # 첫 번째 컬럼 (file_id 혹은 filename)
                    "customer": str(row[1]),  # 두 번째 컬럼 (customer)
                    "count": int(row[2]),     # 세 번째 컬럼 (count)
                    "total": float(row[3] or 0) # 네 번째 컬럼 (sum), None일 경우 0 처리
                } for row in doc_stats
            ],
            "tags": [
                {
                    "tag": str(row[0]), 
                    "count": int(row[1]), 
                    "total": float(row[2] or 0)
                } for row in tag_stats
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