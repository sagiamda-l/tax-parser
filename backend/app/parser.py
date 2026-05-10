import pandas as pd
import pdfplumber
import os
import re

class TaxParser:
    def __init__(self):
        # 9가지 경비 분류 키워드
        self.tag_keywords = {
            "기업업무추진비": ["접대", "선물", "백화점", "식당", "회식", "일식", "한식", "중식", "카페", "베이커리"],
            "차량유지비": ["주유", "충전", "수리", "주차", "하이패스", "오일", "자동차", "타이어", "블루핸즈"],
            "여비교통비": ["택시", "버스", "철도", "코레일", "SRT", "항공", "호텔", "숙박", "카카오T", "대리"],
            "소모품비": ["다이소", "알파", "문구", "쿠팡", "편의점", "마트", "홈플러스", "이마트", "오피스"],
            "기부금": ["기부", "재단", "유니세프", "모금", "교회", "절", "성당", "헌금"],
            "지급수수료": ["수수료", "송금", "대행", "이체", "수입인지"],
            "운반비": ["택배", "화물", "퀵서비스", "배송", "로젠", "경동"],
            "광고선전비": ["구글광고", "페이스북광고", "현수막", "광고", "네이버광고", "인쇄"],
        }

    def suggest_tag(self, vendor):
        for tag, keywords in self.tag_keywords.items():
            if any(kw in vendor for kw in keywords):
                return tag
        return "기타"

    def parse(self, file_path, filename):
        ext = os.path.splitext(filename)[-1].lower()
        if ext in ['.xls', '.xlsx']:
            return self._parse_excel(file_path)
        elif ext == '.pdf':
            return self._parse_pdf(file_path)
        return []

    def _parse_excel(self, file_path):
        # 1. 헤더행 찾기 (강력한 탐색 로직)
        header_row = 0
        df_find = pd.read_excel(file_path, header=None).head(30)
        for i, row in df_find.iterrows():
            row_vals = [str(val) for val in row.values if pd.notna(val)]
            row_str = "".join(row_vals)
            # 카드사별 핵심 키워드 체크
            if any(k in row_str for k in ['금액', '가맹점', '내용', '상호', '결제처', '승인번호']):
                header_row = i
                break
        
        # 2. 데이터 로드 및 컬럼 정규화
        df = pd.read_excel(file_path, header=header_row)
        df.columns = [str(c).replace(" ", "").replace("\n", "") for c in df.columns]

        # 3. 통합 매핑 사전
        mapping = {
            'date': ['이용일자', '거래일자', '일시', '이용일시', '승인일자', '결제일시', '이용일', '거래일'],
            'amount': ['이용금액', '금액', '결제금액', '국내이용금액(원)', '승인금액', '이용금액(원)', '사용금액', '거래금액'],
            'vendor': ['가맹점명', '가맹점', '내용', '상호명', '적요', '결제처', '이용처', '거래처'],
            'user': ['이용자', '카드사용자', '사용자명', '본인/가족', '사용자', '이름']
        }

        found_cols = {}
        for target, aliases in mapping.items():
            for alias in aliases:
                if alias in df.columns:
                    found_cols[target] = alias
                    break

        results = []
        for _, row in df.iterrows():
            vendor = str(row.get(found_cols.get('vendor', ''), '')).strip()
            # 유효성 검사 (빈 행 및 합계 행 제외)
            if not vendor or vendor in ['nan', 'None', '합계', '소계', '이용일자']: continue
            
            # 금액 추출 및 정제
            raw_amt = str(row.get(found_cols.get('amount', 0)))
            try:
                amt = float(re.sub(r'[^0-9.-]', '', raw_amt))
            except: amt = 0
            
            if amt == 0: continue

            # 일자 추출
            raw_date = str(row.get(found_cols.get('date', ''), ''))
            date_match = re.search(r'\d{4}[-/.]\d{2}[-/.]\d{2}', raw_date)
            final_date = date_match.group() if date_match else raw_date.split(' ')[0]

            results.append({
                "pay_date": final_date,
                "amount": amt,
                "vendor": vendor,
                "user": str(row.get(found_cols.get('user', ''), '이성렬')).strip(),
                "tag": self.suggest_tag(vendor)
            })
        return results

    def _parse_pdf(self, file_path):
        results = []
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                tables = page.extract_tables()
                for table in tables:
                    for row in table:
                        # PDF 내 테이블 행에서 금액/일자 패턴 탐색
                        row_str = " ".join([str(c) for c in row if c])
                        # 예: 2025-05-10 50,000원 상호명
                        date_match = re.search(r'\d{4}[-/.]\d{2}[-/.]\d{2}', row_str)
                        amt_match = re.search(r'[\d,]{3,10}', row_str)
                        
                        if date_match and amt_match:
                            vendor = row[-1] if row[-1] else "PDF 추출 내역"
                            results.append({
                                "pay_date": date_match.group(),
                                "amount": float(amt_match.group().replace(',', '')),
                                "vendor": str(vendor).strip(),
                                "user": "이성렬",
                                "tag": self.suggest_tag(str(vendor))
                            })
        return results

parser_engine = TaxParser()