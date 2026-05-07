import pdfplumber
import re

def parse_tax_pdf(file_path):
    results = []
    with pdfplumber.open(file_path) as pdf:
        first_page_text = pdf.pages[0].extract_text() or ""
        
        # 1. 원천징수영수증 (근로소득/사업소득)
        if "원천징수영수증" in first_page_text:
            # 연도 및 성명 추출
            target_name = re.search(r"성\s*명\s*([\w\s]+)", first_page_text)
            target_name = target_name.group(1).strip() if target_name else "미상"
            
            # 결정세액(72번) 또는 소득세 합계 찾기
            for page in pdf.pages:
                tables = page.extract_tables()
                for table in tables:
                    for row in table:
                        row_str = " ".join([str(c) for c in row if c])
                        if "결정세액" in row_str or "72" in row_str:
                            nums = re.findall(r"[\d,]+", row_str)
                            if nums:
                                results.append({
                                    'target_name': target_name,
                                    'amount_type': '결정세액(소득세)',
                                    'amount': float(nums[-1].replace(',', '')),
                                    'classification': '원천징수영수증',
                                    'tag': '세금'
                                })
        
        # 2. 연말정산 간소화 서비스
        elif "소득·세액공제" in first_page_text:
            for page in pdf.pages:
                tables = page.extract_tables()
                for table in tables:
                    for row in table:
                        if not row[0]: continue
                        row_str = " ".join([str(c) for c in row if c])
                        # 기부금, 의료비, 보험료 등 키워드 매칭
                        for kw, tag in {"기부금": "기부", "의료비": "의료", "보험료": "보험"}.items():
                            if kw in row_str:
                                nums = re.findall(r"[\d,]{4,}", row_str) # 1000원 이상만
                                if nums:
                                    results.append({
                                        'target_name': '본인',
                                        'amount_type': kw,
                                        'amount': float(nums[0].replace(',', '')),
                                        'classification': '간소화서비스',
                                        'tag': tag
                                    })
    return results
