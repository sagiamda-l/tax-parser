# 이 구조는 SQLAlchemy나 SQLModel 등 ORM 사용 시 참고할 수 있는 명세입니다.

"""
1. Users: 사용자 정보 (본인 및 부양가족)
   - id, name, rrn(마스킹), role(본인/배우자 등)

2. Incomes: 소득 정보[cite: 1, 2]
   - id, user_id, year, income_type(근로/사업), company_name, 
     total_payment(지급총액), tax_amount(결정세액)

3. Deductions: 공제 항목[cite: 3]
   - id, user_id, year, category(의료비/보험료/카드 등), 
     item_name, amount(금액)
"""