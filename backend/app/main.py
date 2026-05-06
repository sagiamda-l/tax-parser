from fastapi import FastAPI, UploadFile, File
import shutil
import os
from .parser import TaxPdfParser

app = FastAPI()

UPLOAD_DIR = "./data/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.post("/upload/tax-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    # 1. 파일 임시 저장
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # 2. 파싱 로직 호출
    parser = TaxPdfParser(file_path)
    
    # 예시로 표 데이터 일부를 반환 (추후 DB 저장 로직으로 연결)
    parsed_tables = parser.extract_tables()
    
    return {
        "filename": file.filename,
        "table_count": len(parsed_tables),
        "message": "파싱이 완료되었습니다."
    }