from sqlalchemy import Column, Integer, String, Float, DateTime, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import datetime

Base = declarative_base()

# 1. 소득 요약 (원천징수영수증 자료)
class IncomeSummary(Base):
    __tablename__ = "income_summaries"
    id = Column(Integer, primary_key=True)
    year = Column(Integer)
    company = Column(String)
    total_salary = Column(Float)    # 급여 총액
    final_tax = Column(Float)       # 결정세액

# 2. 지출/공제 상세 (간소화 PDF 및 엑셀 카드 내역)[cite: 3]
class ExpenseDetail(Base):
    __tablename__ = "expense_details"
    id = Column(Integer, primary_key=True)
    source = Column(String)         # 'PDF' 또는 'EXCEL'
    category = Column(String)       # '의료비', '식비', '교통비' 등
    store_name = Column(String)     # 가맹점명
    amount = Column(Float)          # 금액
    date = Column(DateTime, default=datetime.datetime.now)

# DB 초기화
engine = create_engine("sqlite:///./data/tax_parser.db")
SessionLocal = sessionmaker(bind=engine)
def init_db():
    Base.metadata.create_all(bind=engine)