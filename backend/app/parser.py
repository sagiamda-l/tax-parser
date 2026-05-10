import pandas as pd
import os

class TaxParser:
    def __init__(self):
        # 9가지 세무 항목 분류용 키워드
        self.tag_keywords = {
            "기업업무추진비": ["접대", "선물", "백화점", "식당", "회식"],
            "차량유지비": ["주유", "충전", "수리", "주차", "하이패스", "오일"],
            "여비교통비": ["택시", "버스", "철도", "코레일", "SRT", "항공", "호텔"],
            "소모품비": ["다이소", "알파", "문구", "쿠팡", "편의점"],
            "기부금": ["기부", "재단", "유니세프", "모금", "교회", "절"],
            "지급수수료": ["수수료", "송금", "대행"],
            "운반비": ["택배", "화물", "퀵서비스"],
            "광고선전비": ["구글광고", "페이스북광고", "현수막"]
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
        # 엑셀 상단 불필요한 행이 있을 수 있으므로 실제 데이터 시작점(헤더)을 찾습니다.
        df_raw = pd.read_excel(file_path)
        
        # 국민카드 등에서 흔히 쓰이는 컬럼명 리스트
        col_map = {
            'pay_date': ['이용일자', '거래일자', '일시', '이용일시', '승인일자'],
            'amount': ['이용금액', '금액', '결제금액', '국내이용금액(원)', '승인금액'],
            'vendor': ['가맹점명', '가맹점', '내용', '상호명', '적요'],
            'user': ['이용자', '카드사용자', '사용자명', '본인/가족']
        }

        # 실제 존재하는 컬럼명으로 매핑 정보 생성
        actual_cols = {}
        for key, aliases in col_map.items():
            for alias in aliases:
                if alias in df_raw.columns:
                    actual_cols[key] = alias
                    break
        
        # 만약 컬럼을 못 찾았다면, 데이터 내부에서 헤더를 다시 탐색 (row 0~5 사이)
        if 'vendor' not in actual_cols:
            for i in range(5):
                temp_df = pd.read_excel(file_path, header=i)
                for key, aliases in col_map.items():
                    for alias in aliases:
                        if alias in temp_df.columns:
                            actual_cols[key] = alias
                if 'vendor' in actual_cols:
                    df_raw = temp_df
                    break

        results = []
        for _, row in df_raw.iterrows():
            vendor = str(row.get(actual_cols.get('vendor'), '')).strip()
            if not vendor or vendor == 'nan': continue # 빈 행 무시

            results.append({
                "pay_date": str(row.get(actual_cols.get('pay_date'), '')).split(' ')[0],
                "amount": float(str(row.get(actual_cols.get('amount'), 0)).replace(',', '')),
                "vendor": vendor,
                "user": str(row.get(actual_cols.get('user'), '이성렬')),
                "tag": self.suggest_tag(vendor)
            })
        return results

parser_engine = TaxParser()