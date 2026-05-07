import pdfplumber
import pandas as pd
import re
import os

def parse_file(file_path):
    ext = os.path.splitext(file_path)[-1].lower()
    
    if ext == '.pdf':
        return parse_pdf(file_path)
    elif ext in ['.xlsx', '.xls']:
        return parse_excel(file_path)
    return []

def parse_pdf(file_path):
    extracted_data = []
    
    with pdfplumber.open(file_path) as pdf:
        # 첫 페이지 텍스트로 문서 종류 판별
        full_text = ""
        for page in pdf.pages[:2]: # 보통 1~2페이지 안에 결정됨
            full_text += page.extract_text() or ""

        # 1. 근로소득 원천징수영수증 처리
        if "원천징수영수증" in full_text:
            extracted_data.extend(extract_withholding_tax(pdf))
            
        # 2. 연말정산 간소화 자료 처리[cite: 3]
        elif "소득·세액공제" in full_text or "국세청" in full_text:
            extracted_data.extend(extract_simplification_data(pdf))
            
    return extracted_data

def extract_withholding_tax(pdf):
    """원천징수영수증에서 급여와 결정세액 추출[cite: 1, 2]"""
    data = []
    all_tables = []
    for page in pdf.pages:
        all_tables.extend(page.extract_tables())

    # 기본값 설정
    year = 0
    company = "알수없음"
    total_salary = 0.0
    final_tax = 0.0

    # 텍스트에서 연도 및 회사명 추출 (정규식 사용)
    first_page_text = pdf.pages[0].extract_text()
    year_match = re.search(r"(20\d{2})년도", first_page_text)
    if year_match: year = int(year_match.group(1))

    # 표를 순회하며 급여(16번) 및 결정세액(72번) 위치 탐색
    for table in all_tables:
        for row in table:
            row_str = " ".join([str(cell) for cell in row if cell])
            # 급여 (보통 16번 항목)
            if "급여" in row_str and "16" in row_str:
                nums = re.findall(r"[\d,]+", row_str)
                if nums: total_salary = float(nums[-1].replace(',', ''))
            # 결정세액 (보통 72번 항목)
            if "결정세액" in row_str or ("72" in row_str and "소득세" in row_str):
                nums = re.findall(r"[\d,]+", row_str)
                if nums: final_tax = float(nums[-1].replace(',', ''))

    data.append({
        'type': 'INCOME',
        'year': year or 2025,
        'company': company,
        'total_salary': total_salary,
        'final_tax': final_tax
    })
    return data

def extract_simplification_data(pdf):
    """간소화 PDF에서 항목별 지출액 추출[cite: 3]"""
    data = []
    for page in pdf.pages:
        tables = page.extract_tables()
        for table in tables:
            for row in table:
                # 금액 형식을 가진 셀이 있는지 확인 (예: 1,234,567)
                row_str = " ".join([str(cell) for cell in row if cell])
                if any(kw in row_str for kw in ["보장성보험", "의료비", "교육비", "신용카드"]):
                    nums = re.findall(r"[\d,]{4,}", row_str) # 1,000원 이상만 추출
                    if nums:
                        data.append({
                            'type': 'EXPENSE',
                            'category': row[0].replace('\n', '') if row[0] else "공제항목",
                            'amount': float(nums[0].replace(',', ''))
                        })
    return data

def parse_excel(file_path):
    """엑셀 파일(카드 내역 등)에서 지출 내역 추출"""
    data = []
    try:
        df = pd.read_excel(file_path)
        
        # 컬럼명 유연하게 대응 (토스, 삼성, 농협 등 공통 키워드)
        col_map = {
            'amount': ['이용금액', '금액', '승인금액', '지출'],
            'store': ['가맹점명', '사용처', '가맹점', '내용'],
            'date': ['이용일자', '승인일시', '거래일자']
        }
        
        # 실제 데이터프레임의 컬럼과 매핑
        target_cols = {}
        for key, keywords in col_map.items():
            for col in df.columns:
                if any(kw in str(col) for kw in keywords):
                    target_cols[key] = col
                    break

        if 'amount' in target_cols:
            for _, row in df.iterrows():
                amt = str(row[target_cols['amount']]).replace(',', '')
                try:
                    data.append({
                        'type': 'EXPENSE',
                        'category': '카드지출',
                        'store_name': str(row[target_cols['store']]) if 'store' in target_cols else '기타',
                        'amount': float(amt) if amt != 'nan' else 0.0
                    })
                except: continue
    except Exception as e:
        print(f"Excel parsing error: {e}")
        
    return data