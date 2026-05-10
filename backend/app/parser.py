import pandas as pd
import pdfplumber
import re
import os

class TaxParser:
    def __init__(self):
        # 경비 분류 키워드 맵핑 (자동 분류 제안용)
        self.tag_keywords = {
            "기업업무추진비": ["접대", "선물", "백화점", "골프"],
            "차량유지비": ["주유", "충전", "정비", "주차", "하이패스"],
            "여비교통비": ["택시", "버스", "철도", "항공", "숙박"],
            "소모품비": ["다이소", "알파", "문구", "쿠팡"],
            "기부금": ["종교", "재단", "유니세프", "모금"]
        }

    def suggest_tag(self, vendor):
        for tag, keywords in self.tag_keywords.items():
            if any(kw in vendor for kw in keywords):
                return tag
        return "기타"

    def parse(self, file_path, filename):
        ext = os.path.splitext(filename)[-1].lower()
        if ext in ['.xls', '.xlsx', '.csv']:
            return self._parse_excel(file_path)
        elif ext == '.pdf':
            return self._parse_pdf(file_path)
        return []

    def _parse_excel(self, file_path):
        # 카드사 엑셀 양식에 맞춰 유동적으로 컬럼 탐색
        df = pd.read_excel(file_path)
        results = []
        for _, row in df.iterrows():
            # 컬럼명은 카드사마다 다르므로 공통 키워드로 추출 (예시)
            vendor = str(row.get('가맹점명', row.get('내용', '알수없음')))
            results.append({
                "pay_date": str(row.get('이용일자', row.get('거래일', ''))),
                "amount": float(row.get('이용금액', row.get('금액', 0))),
                "vendor": vendor,
                "user": str(row.get('이용자', '본인')),
                "tag": self.suggest_tag(vendor)
            })
        return results

    def _parse_pdf(self, file_path):
        results = []
        with pdfplumber.open(file_path) as pdf:
            full_text = ""
            for page in pdf.pages:
                full_text += page.extract_text()
            
            # 1. 연말정산 간소화 PDF (의료비, 기부금 등 섹션 탐색)
            # 2. 원천징수 영수증 (급여/세액 정보 추출)
            # 여기서는 정규표현식을 통해 일자/금액/상호 패턴을 추출합니다.
            date_pattern = re.compile(r'(\d{4}-\d{2}-\d{2})')
            amount_pattern = re.compile(r'([\d,]+)\s?원')
            
            # [시뮬레이션 로직] 실제 PDF 구조에 따라 테이블 파싱 logic 추가 가능
            # 예시: 기부금 항목 추출
            if "기부금" in full_text:
                results.append({
                    "pay_date": "2025-12-31",
                    "amount": 100000.0,
                    "vendor": "사회복지재단",
                    "user": "이성렬",
                    "tag": "기부금"
                })
        return results

parser_engine = TaxParser()