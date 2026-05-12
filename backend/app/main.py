from fastapi import FastAPI, UploadFile, File, Depends, Form, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from .database import SessionLocal, init_db, UploadFileRecord, CardRecord
import random, os
from datetime import datetime
from typing import List
from .parser import parser_engine
from sqlalchemy import func
import pandas as pd
from io import BytesIO
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

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
            raise HTTPException(status_code=409, detail="이미 업로드된 파일명입니다. 기존 파일을 삭제 후 다시 시도하세요.")
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

@app.post("/update-tags")
def update_tags(updates: list[dict], db: Session = Depends(get_db)):
    # [{id: 1, tag: '소모품비'}, ...] 형식의 리스트 수신
    for item in updates:
        db.query(CardRecord).filter(CardRecord.id == item['id'])\
          .update({"tag": item['tag']})
    db.commit()
    return {"message": "Tags updated"}

@app.post("/bulk-vendor-update")
def bulk_vendor_update(data: dict, db: Session = Depends(get_db)):
    # {vendor: '가맹점명', tag: '변경할태그'} 수신
    db.query(CardRecord).filter(CardRecord.vendor == data['vendor'])\
      .update({"tag": data['tag']})
    db.commit()
    return {"message": f"All {data['vendor']} updated to {data['tag']}"}

# 1. 자동 태그 추천 엔진
@app.get("/recommend-tag")
def recommend_tag(vendor: str, db: Session = Depends(get_db)):
    # 해당 가맹점에 대해 가장 많이 사용된 태그를 검색
    result = db.query(CardRecord.tag, func.count(CardRecord.tag).label('cnt'))\
        .filter(CardRecord.vendor == vendor)\
        .group_by(CardRecord.tag)\
        .order_by(desc('cnt')).first()
    return {"tag": result[0] if result else "기타"}

# 1. 엑셀 내보내기 (데이터 정제 및 헤더 한글화)
@app.post("/export/excel")
async def export_excel(data: list[dict]):
    df = pd.DataFrame(data)
    
    # 불필요 항목 제거 및 컬럼명 변경
    columns_map = {
        'pay_date': '결제일자',
        'customer': '이용자',
        'vendor': '가맹점명',
        'amount': '금액',
        'tag': '지출태그',
        'filename': '원본파일명'
    }
    
    # 존재하는 컬럼만 필터링 및 이름 변경
    export_df = df[[c for c in columns_map.keys() if c in df.columns]].rename(columns=columns_map)
    
    # 날짜 포맷 통일 (YYYY-MM-DD)
    if '결제일자' in export_df.columns:
        export_df['결제일자'] = pd.to_datetime(export_df['결제일자']).dt.strftime('%Y-%m-%d')

    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        export_df.to_excel(writer, index=False, sheet_name='지출내역_리포트')
    
    return StreamingResponse(
        BytesIO(output.getvalue()), 
        media_type="application/vnd.ms-excel", 
        headers={"Content-Disposition": "attachment; filename=tax_report.xlsx"}
    )

# 2. PDF 종합 보고서 생성 (구조화된 리포트)
@app.post("/export/pdf")
async def export_pdf(data: dict):
    # data 구조: { "summary": {...}, "records": [...] }
    buffer = BytesIO()
    p = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    # (주의: 한글 폰트 설정이 필요합니다. 여기서는 구조적 예시만 작성합니다)
    p.setFont("Helvetica-Bold", 20)
    p.drawString(50, height - 50, "Tax Settlement Report")
    
    p.setFont("Helvetica", 12)
    p.drawString(50, height - 80, f"Total Amount: {data['totalAmount']:,} KRW")
    p.drawString(50, height - 100, f"Total Count: {len(data['records'])} cases")
    
    # 상세 내역 테이블 형태로 드로잉 (생략 - 실제 구현 시 루프 사용)
    p.showPage()
    p.save()
    
    buffer.seek(0)
    return StreamingResponse(buffer, media_type="application/pdf")