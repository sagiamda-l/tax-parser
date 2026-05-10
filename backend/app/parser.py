import pandas as pd
import os
import re

class TaxParser:
    def __init__(self):
        # 9가지 세무 항목 분류용 키워드
        self.tag_keywords = {
            "기업업무추진비": ["접대", "선물", "백화점", "식당", "회식", "일식", "한식", "중식"],
            "차량유지비": ["주유", "충전", "수리", "주차", "하이패스", "오일", "자동차"],
            "여비교통비": ["택시", "버스", "철도", "코레일", "SRT", "항공", "호텔", "숙박", "카카오T"],
            "소모품비": ["다이소", "알파", "문구", "쿠팡", "편의점", "마트", "홈플러스", "이마트"],
            "기부금": ["기부", "재단", "유니세프", "모금", "교회", "절", "성당"],
            "지급수수료": ["수수료", "송금", "대행", "이체"],
            "운반비": ["택배", "화물", "퀵서비스", "배송"],
            "광고선전비": ["구글광고", "페이스북광고", "현수막", "광고", "네이버광고"]
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
        return []

    def _parse_excel(self, file_path):
        # 1. 헤더 탐색 로직: 실제 데이터가 시작되는 행을 찾음
        df_tmp = pd.read_excel(file_path, header=None).head(20) # 상단 20행 조사
        header_row = 0
        
        for i, row in df_tmp.iterrows():
            row_str = "".join([str(c) for c in row.values])
            if any(k in row_str for k in ['금액', '가맹점', '상호', '내용', '결제처']):
                header_row = i
                break
        
        # 2. 찾은 헤더행을 기준으로 데이터 다시 읽기
        df = pd.read_excel(file_path, header=header_row)
        
        # 컬럼명 공백 제거 및 표준화
        df.columns = [str(c).replace(" ", "").replace("\n", "") for c in df.columns]

        # 3. 카드사별 통합 컬럼 매핑 딕셔너리
        col_map = {
            'pay_date': ['이용일자', '거래일자', '일시', '이용일시', '승인일자', '결제일시', '이용일'],
            'amount': ['이용금액', '금액', '결제금액', '국내이용금액(원)', '승인금액', '이용금액(원)', '사용금액'],
            'vendor': ['가맹점명', '가맹점', '내용', '상호명', '적요', '결제처', '이용처'],
            'user': ['이용자', '카드사용자', '사용자명', '본인/가족', '사용자']
        }

        actual_cols = {}
        for target, aliases in col_map.items():
            for alias in aliases:
                if alias in df.columns:
                    actual_cols[target] = alias
                    break

        results = []
        for _, row in df.iterrows():
            # 필수 데이터(가맹점, 금액)가 없으면 스킵
            vendor = str(row.get(actual_cols.get('vendor', ''), '')).strip()
            if not vendor or vendor in ['nan', 'None', '합계', '소계']:
                continue

            # 날짜 정제
            raw_date = str(row.get(actual_cols.get('pay_date', ''), ''))
            pay_date = raw_date.split(' ')[0] if raw_date else ""
            
            # 금액 정제 (쉼표 및 통화기호 제거)
            raw_amount = str(row.get(actual_cols.get('amount', 0)))
            amount = float(re.sub(r'[^0-9.-]', '', raw_amount)) if raw_amount != 'nan' else 0
            
            if amount == 0: continue # 금액이 0원인 행 제외

            results.append({
                "pay_date": pay_date,
                "amount": amount,
                "vendor": vendor,
                "user": str(row.get(actual_cols.get('user', ''), '이성렬')).strip(),
                "tag": self.suggest_tag(vendor)
            })
        
        return results

parser_engine = TaxParser()