import pandas as pd

def parse_card_excel(file_path):
    # 엑셀 시트 읽기 (첫 몇 줄의 빈 칸 제외 로직 포함)
    try:
        # 카드사 판별을 위해 파일명 또는 컬럼명 확인
        df_raw = pd.read_excel(file_path, header=None)
        content_sample = str(df_raw.head(20))
        
        # 1. 토스카드
        if "토스" in file_path or "카드 이용내역 확인서" in content_sample:
            df = pd.read_excel(file_path, skiprows=14)
            df = df[df['취소여부'] != '취소'] # 취소 제외
            return [{
                'pay_date': str(row['매출일자']), 'amount': row['매출금액'],
                'vendor': row['가맹점명'], 'biz_no': row['사업자번호'],
                'industry': '기타', 'classification': '토스'
            } for _, row in df.iterrows() if pd.notna(row['매출금액'])]

        # 2. 삼성카드
        elif "삼성" in file_path or "개인사업자용" in content_sample:
            df = pd.read_excel(file_path, skiprows=18)
            return [{
                'pay_date': str(row['이용일']), 'amount': row['이용금액(원)'],
                'vendor': row['가맹점명'], 'biz_no': row['사업자번호'],
                'industry': row['업종'], 'classification': '삼성'
            } for _, row in df.iterrows() if row['매출'] != '취소']
            
        # 3. 국민카드 (CSV 변환 케이스 대응 가능)
        elif "국민" in file_path:
            df = pd.read_excel(file_path, skiprows=14)
            return [{
                'pay_date': str(row['이용일']), 'amount': row['매출금액'],
                'vendor': row['가맹점명'], 'biz_no': row['사업자번호'],
                'industry': '기타', 'classification': '국민'
            } for _, row in df.iterrows() if row['취소여부'] != '취소']

    except Exception as e:
        print(f"Error parsing card excel: {e}")
    return []