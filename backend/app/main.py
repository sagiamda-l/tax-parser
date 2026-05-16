import random, os, io, sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, UploadFile, File, Depends, Form, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from .database import SessionLocal, init_db, UploadFileRecord, CardRecord
from datetime import datetime
from typing import List
from .parser import parser_engine
from sqlalchemy import func
import pandas as pd
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from google_sheet import GoogleSheetsManager
from pydantic import BaseModel

# Docker 볼륨 경로 설정
DATA_FOLDER = "./data" 
DB_PATH = os.path.join(DATA_FOLDER, "tax_parser.db")
gs_manager = GoogleSheetsManager(DATA_FOLDER)

# --- [한글 폰트 등록 처리] ---
# ./data 폴더에 NanumGothic.ttf 등의 폰트 파일을 같이 넣어두면 PDF 한글 인식이 가능합니다.
FONT_NAME = "Helvetica"
for font_file in ["NanumGothic.ttf", "Malgun.ttf", "unbatang.ttf", "NanumSquare.ttf"]:
    potential_path = os.path.join(DATA_FOLDER, font_file)
    if os.path.exists(potential_path):
        pdfmetrics.registerFont(TTFont("KoreanFont", potential_path))
        FONT_NAME = "KoreanFont"
        break

# --- [Pydantic 요청 스키마] ---
class SyncRequest(BaseModel):
    year: int | str  # 숫자와 문자열 입력을 모두 허용합니다. (Python 3.10+ 문법)

class RecordItem(BaseModel):
    pay_date: str
    customer: str
    vendor: str
    amount: int
    tag: str

class PDFExportRequest(BaseModel):
    totalAmount: int
    records: list[RecordItem]

class TagUpdateItem(BaseModel):
    id: int
    tag: str

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
@app.get("/api/recommend-tag")
def recommend_tag(vendor: str, db: Session = Depends(get_db)):
    if not vendor:
        return {"tag": "불필요"}
    
    # 에러가 발생하던 desc('cnt') 대신 func.count().desc() 구조로 변경하여 안정성 확보
    result = db.query(CardRecord.tag)\
               .filter(CardRecord.vendor == vendor)\
               .group_by(CardRecord.tag)\
               .order_by(func.count(CardRecord.tag).desc())\
               .first()
               
    return {"tag": result[0] if result else "불필요"}

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
    #if '결제일자' in export_df.columns:
    #    export_df['결제일자'] = pd.to_datetime(export_df['결제일자']).dt.strftime('%Y-%m-%d')

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
async def export_pdf(request: PDFExportRequest):
    """
    UI에서 필터링된 내역과 총 금액을 바탕으로 깔끔한 구조의 세무 결산 PDF를 실시간 생성합니다.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, 
        pagesize=A4,
        rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30
    )
    
    styles = getSampleStyleSheet()
    
    # 스타일 재정의 (등록된 한글 폰트 반영)
    title_style = ParagraphStyle(
        'PDFTitle',
        parent=styles['Heading1'],
        fontName=FONT_NAME,
        fontSize=24,
        leading=28,
        textColor=colors.HexColor("#6750a4"),
        alignment=1, # 가운데 정렬
        spaceAfter=20
    )
    
    body_style = ParagraphStyle(
        'PDFBody',
        parent=styles['Normal'],
        fontName=FONT_NAME,
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#1d1b20")
    )
    
    header_style = ParagraphStyle(
        'PDFHeader',
        parent=styles['Normal'],
        fontName=FONT_NAME,
        fontSize=10,
        leading=12,
        textColor=colors.white,
        alignment=1
    )

    story = []
    
    # 문서 제목 및 요약 정보
    story.append(Paragraph("세무 결산 보고서 (Tax Master Report)", title_style))
    story.append(Spacer(1, 10))
    story.append(Paragraph(f"<b>총 집계 금액:</b> {request.totalAmount:,} 원", body_style))
    story.append(Paragraph(f"<b>총 추출 건수:</b> {len(request.records):,} 건", body_style))
    story.append(Spacer(1, 15))
    
    # 테이블 데이터 구조화
    table_data = [[
        Paragraph("<b>날짜</b>", header_style),
        Paragraph("<b>이용자</b>", header_style),
        Paragraph("<b>가맹점</b>", header_style),
        Paragraph("<b>금액</b>", header_style),
        Paragraph("<b>태그</b>", header_style)
    ]]
    
    for r in request.records:
        table_data.append([
            Paragraph(r.pay_date, body_style),
            Paragraph(r.customer, body_style),
            Paragraph(r.vendor, body_style),
            Paragraph(f"{r.amount:,}원", body_style),
            Paragraph(r.tag, body_style)
        ])
        
    # MD3 컬러 수치를 가미한 테이블 스타일링
    record_table = Table(table_data, colWidths=[80, 70, 180, 90, 110])
    record_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#6750a4")), # Header 배경
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cac4d0")), # 그리드 라인 명도 보정
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#fef7ff")]), # 교차 행 배경
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
    ]))
    
    story.append(record_table)
    doc.build(story)
    
    buffer.seek(0)
    return StreamingResponse(
        buffer, 
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=Tax_Report.pdf"}
    )

@app.post("/api/sync-sheets")
async def sync_sheets(request: SyncRequest):
    # 어떤 타입이 들어오든 안전하게 문자열("2026")로 변환합니다.
    year_str = str(request.year).strip()

    if not year_str or year_str == "None":
        raise HTTPException(status_code=400, detail="연도 정보가 필요합니다.")

    # 구글 시트 매니저에는 변환된 문자열 전달
    result = gs_manager.sync_sqlite_to_sheets(DB_PATH, year_str)
    if result["status"] == "error":
        raise HTTPException(status_code=500, detail=result["message"])
        
    return result