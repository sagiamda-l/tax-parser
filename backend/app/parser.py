import pandas as pd
import pdfplumber
import os
import re

class TaxParser:
    def __init__(self):
        # 9가지 세무 항목 분류 키워드
        self.tag_keywords = {
            "기업업무추진비": ["접대", "선물", "백화점", "식당", "회식", "일식", "한식", "중식", "카페", "베이커리", "골프"],
            "차량유지비": ["주유", "충전", "수리", "주차", "하이패스", "오일", "자동차", "타이어", "블루핸즈", "세차"],
            "여비교통비": ["택시", "버스", "철도", "코레일", "SRT", "항공", "호텔", "숙박", "카카오T", "대리", "통행료"],
            "소모품비": ["다이소", "알파", "문구", "쿠팡", "편의점", "마트", "홈플러스", "이마트", "오피스", "문구"],
            "기부금": ["기부", "재단", "유니세프", "모금", "교회", "절", "성당", "헌금", "적십자"],
            "지급수수료": ["수수료", "송금", "대행", "이체", "수입인지", "특허", "공증"],
            "운반비": ["택배", "화물", "퀵서비스", "배송", "로젠", "경동", "CJ대한통운"],
            "광고선전비": ["구글광고", "페이스북광고", "현수막", "광고", "네이버광고", "인쇄", "배너"],
        }

    def suggest_tag(self, vendor):
        for tag, keywords in self.tag_keywords.items():
            if any(kw in vendor for kw in keywords):
                return tag
        return "기타"

    def parse(self, file_path, filename):
        localFilename = os.path.basename(filename)
        ext = localFilename.lower()
        if ext in ['.xls', '.xlsx']:
            return self._parse_excel(file_path)
        elif ext == '.pdf':
            return self._parse_pdf(file_path)
        return []

    def _parse_excel(self, file_path):
        # 1. 헤더 행 찾기 (카드사별로 0~15행 사이에 헤더가 있음)
        df_raw = pd.read_excel(file_path, header=None)
        header_row = 0
        
        # 컬럼명 키워드 정의
        col_keywords = {
            'date': ['일자', '일시', '거래일', '승인일'],
            'amount': ['금액', '결제금액', '국내이용금액', '거래금액', '승인금액'],
            'vendor': ['가맹점', '내용', '상호명', '결제처', '이용처', '적요']
        }

        # 엑셀의 상단 20줄을 검사하여 헤더 위치 파악
        for i in range(min(len(df_raw), 20)):
            row_str = "".join([str(val) for val in df_raw.iloc[i].values if pd.notna(val)])
            # 날짜, 금액, 가맹점 관련 단어가 모두 한 행에 들어있는지 확인
            if any(d in row_str for d in col_keywords['date']) and \
               any(a in row_str for a in col_keywords['amount']) and \
               any(v in row_str for v in col_keywords['vendor']):
                header_row = i
                break

        # 2. 파악된 헤더로 데이터 재로드
        df = pd.read_excel(file_path, header=header_row)
        df.columns = [str(c).replace(" ", "").replace("\n", "") for c in df.columns]

        # 3. 컬럼 매핑 자동 결정
        mapping = {}
        for target, aliases in col_keywords.items():
            for alias in aliases:
                # '컬럼명'에 alias가 포함되어 있는지 확인 (예: '국내이용금액(원)'에 '금액'이 포함됨)
                match = [c for c in df.columns if alias in c]
                if match:
                    mapping[target] = match[0]
                    break
        
        # 'user' 컬럼은 별도 체크
        user_col = next((c for c in df.columns if any(u in c for u in ['이용자', '사용자', '이름'])), None)
        mapping['user'] = user_col

        results = []
        for _, row in df.iterrows():
            vendor = str(row.get(mapping.get('vendor', ''), '')).strip()
            # 빈 행, 합계, 날짜 정보가 없는 행은 제외
            if not vendor or vendor in ['nan', 'None', '합계', '소계', '이용일자']: continue
            
            # 금액 정제
            raw_amt = str(row.get(mapping.get('amount', 0), '0'))
            try:
                # 숫자, 소수점, 마이너스 기호 외 제거
                amt_str = re.sub(r'[^0-9.-]', '', raw_amt)
                amt = float(amt_str) if amt_str else 0
            except: amt = 0
            
            if amt == 0: continue

            # 날짜 정제
            raw_date = str(row.get(mapping.get('date', ''), ''))
            date_match = re.search(r'\d{4}[-/.]\d{2}[-/.]\d{2}', raw_date)
            final_date = date_match.group() if date_match else raw_date.split(' ')[0]

            results.append({
                "pay_date": final_date,
                "amount": amt,
                "vendor": vendor,
                "user": str(row.get(mapping['user'], '이성렬')) if mapping['user'] else "이성렬",
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
                        if not row or len(row) < 3: continue
                        row_str = " ".join([str(c) for c in row if c])
                        
                        # 국세청 PDF 등에서 날짜와 금액 패턴 탐색
                        date_match = re.search(r'\d{4}[-/.]\d{2}[-/.]\d{2}', row_str)
                        # 금액 패턴 (천단위 콤마 포함 3자리 이상 숫자)
                        amt_match = re.search(r'[\d,]{4,15}', row_str)
                        
                        if date_match and amt_match:
                            # 행의 마지막 요소를 가맹점으로 추정 (일반적인 테이블 구조)
                            vendor = str(row[-1]).replace("\n", " ").strip() if row[-1] else "PDF 추출 내역"
                            results.append({
                                "pay_date": date_match.group(),
                                "amount": float(amt_match.group().replace(',', '')),
                                "vendor": vendor,
                                "user": "이성렬",
                                "tag": self.suggest_tag(vendor)
                            })
        return results

parser_engine = TaxParser()