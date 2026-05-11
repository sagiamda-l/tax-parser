import pandas as pd
import pdfplumber
import os, re

class TaxParser:
    def __init__(self):
        # 9가지 세무 항목 분류 키워드
        self.tag_keywords = {
            "기업업무추진비": ["접대", "선물", "식당", "회식", "일식", "한식", "중식", "카페", "주점"],
            "차량유지비": ["주유", "충전", "수리", "주차", "하이패스", "오일", "자동차", "타이어"],
            "여비교통비": ["택시", "버스", "철도", "코레일", "SRT", "항공", "호텔", "숙박", "카카오T"],
            "소모품비": ["다이소", "알파", "문구", "쿠팡", "편의점", "마트", "홈플러스", "이마트"],
            "기부금": ["기부", "재단", "유니세프", "모금", "교회", "절", "성당", "헌금"],
            "지급수수료": ["수수료", "송금", "대행", "이체"],
            "운반비": ["택배", "화물", "퀵서비스", "배송"],
            "광고선전비": ["구글광고", "페이스북광고", "현수막", "광고"],
        }
        # 취소 여부를 판단할 컬럼명과 키워드
        self.status_cols = ['구분', '상태', '처리구분', '승인구분', '취소여부']
        self.cancel_keywords = ['취소', '승인취소', '매출취소', '부분취소']

    def extract_customer(self, filename):
        match = re.search(r'^([^\(]+)\(', filename)
        return match.group(1).strip() if match else "미지정"

    def suggest_tag(self, vendor):
        for tag, keywords in self.tag_keywords.items():
            if any(kw in vendor for kw in keywords):
                return tag
        return "기타"

    def parse(self, file_path, filename):
        # [수정 포인트] 튜플 반환 처리 및 확장자만 추출
        _, ext = os.path.splitext(filename)
        ext = ext.lower()

        if ext in ['.xls', '.xlsx']:
            return self._parse_excel(file_path)
        elif ext == '.pdf':
            return self._parse_pdf(file_path)
        return []

    def _parse_excel(self, file_path):
        # 1. 헤더 찾기: 첫 20행 중 키워드가 2개 이상 포함된 행 탐색
        df_raw = pd.read_excel(file_path, header=None)
        header_row = 0
        keywords = ['일자', '금액', '가맹점', '상호', '내용', '결제처']
        
        for i in range(min(len(df_raw), 20)):
            row_str = "".join([str(val) for val in df_raw.iloc[i].values if pd.notna(val)])
            if sum(1 for k in keywords if k in row_str) >= 2:
                header_row = i
                break

        # 2. 데이터 재로드 및 컬럼 표준화
        df = pd.read_excel(file_path, header=header_row)
        df.columns = [str(c).replace(" ", "").replace("\n", "") for c in df.columns]

        # 3. 카드사 통합 컬럼 매핑
        col_map = {
            'date': ['이용일자', '거래일자', '일시', '이용일시', '승인일자', '결제일시', '거래일', '이용일', '매출일자'],
            'amount': ['이용금액', '금액', '결제금액', '국내이용금액', '승인금액', '거래금액', '사용금액'],
            'vendor': ['가맹점명', '가맹점', '내용', '상호명', '적요', '결제처', '이용처'],
            'status': self.status_cols # 취소 상태 컬럼 탐색
        }

        found = {}
        for target, aliases in col_map.items():
            for alias in aliases:
                match = [c for c in df.columns if alias in c]
                if match:
                    found[target] = match[0]
                    break

        results = []
        for _, row in df.iterrows():
            # [수정] 취소 여부 확인
            if found['status']:
                status_val = str(row.get(found['status'], ''))
                if any(ck in status_val for ck in self.cancel_keywords):
                    continue # 취소 건 스킵

            vendor = str(row.get(found.get('vendor', ''), '')).strip()
            if not vendor or vendor in ['nan', 'None', '합계', '소계']: continue
            
            # 금액 정제: 숫자 외 모든 문자 제거
            raw_amt = str(row.get(found.get('amount', 0), '0'))
            amt_digit = re.sub(r'[^0-9.-]', '', raw_amt)
            amt = float(amt_digit) if amt_digit else 0
            
            if amt <= 0: continue

            # 날짜 정제
            raw_date = str(row.get(found.get('date', ''), ''))
            date_match = re.search(r'\d{4}[-/.]\d{2}[-/.]\d{2}', raw_date)
            final_date = date_match.group() if date_match else raw_date.split(' ')[0]

            results.append({
                "pay_date": final_date,
                "amount": amt,
                "vendor": vendor,
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
                        row_str = " ".join([str(c) for c in row if c])
                        date_m = re.search(r'\d{4}[-/.]\d{2}[-/.]\d{2}', row_str)
                        amt_m = re.search(r'[\d,]{4,15}', row_str)
                        
                        if date_m and amt_m:
                            # PDF 테이블 구조상 보통 마지막이나 뒤에서 두번째가 상호명
                            vendor = str(row[-1] if row[-1] else row[-2]).strip()
                            results.append({
                                "pay_date": date_m.group(),
                                "amount": float(amt_m.group().replace(',', '')),
                                "vendor": vendor if vendor != 'None' else "PDF 내역",
                                "user": "이성렬",
                                "tag": self.suggest_tag(vendor)
                            })
        return results

parser_engine = TaxParser()