import pandas as pd
import numpy as np

def parse_card_excel(file_path):
    try:
        # 모든 시트를 읽어서 '이용내역'이 포함된 시트나 첫 번째 시트 선택
        df_raw = pd.read_excel(file_path, header=None)
        
        # 1. 헤더 위치 자동 찾기 (키워드 '가맹점' 또는 '매출금액'이 있는 행)
        header_idx = 0
        for i, row in df_raw.head(20).iterrows():
            row_str = "".join([str(c) for c in row.values])
            if "가맹점" in row_str or "매출금액" in row_str or "이용금액" in row_str:
                header_idx = i
                break
        
        # 실제 데이터 읽기
        df = pd.read_excel(file_path, skiprows=header_idx)
        df.columns = df.columns.str.replace(r'\s+', '', regex=True) # 컬럼명 공백 제거

        # 2. 카드사 판별 및 컬럼 매핑
        results = []
        
        # 취소 여부 확인 컬럼명 후보
        cancel_cols = [c for c in df.columns if '취소' in c or '상태' in c]
        amount_cols = [c for c in df.columns if '금액' in c and '매출' in c or '이용금액' in c]
        date_cols = [c for c in df.columns if '일자' in c or '이용일' in c]
        vendor_cols = [c for c in df.columns if '가맹점' in c or '내용' in c]
        biz_cols = [c for c in df.columns if '사업자' in c]

        for _, row in df.iterrows():
            # 취소 건 제외 로직
            is_cancel = False
            for c_col in cancel_cols:
                if '취소' in str(row[c_col]):
                    is_cancel = True
                    break
            if is_cancel: continue

            # 데이터 추출 (NaN 방어 로직)
            try:
                amt = row[amount_cols[0]] if amount_cols else 0
                if pd.isna(amt) or amt == 0: continue
                
                results.append({
                    'pay_date': str(row[date_cols[0]]) if date_cols else "",
                    'amount': float(str(amt).replace(',', '')),
                    'vendor': str(row[vendor_cols[0]]) if vendor_cols else "미지정",
                    'biz_no': str(row[biz_cols[0]]) if biz_cols else "",
                    'industry': str(row.get('업종', '')),
                    'classification': 'KB국민' if '국민' in file_path else '기타카드',
                })
            except: continue
            
        return results
    except Exception as e:
        print(f"Excel 파싱 에러 ({file_path}): {e}")
        return []
