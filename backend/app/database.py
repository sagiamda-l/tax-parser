from sqlalchemy import Column, Integer, String, Float, Date, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
basedir = os.path.abspath(os.path.dirname(__file__))
print("Basedir:", basedir)
engine = create_engine('sqlite:///' + os.path.join(basedir, '../data/tax_parser.db'))

Base = declarative_base()

class CardRecord(Base):
    __tablename__ = "card_records"
    id = Column(Integer, primary_key=True)
    pay_date = Column(String)      # 결제일
    amount = Column(Float)         # 결제금액
    vendor = Column(String)        # 업체명
    biz_no = Column(String)        # 사업자번호
    industry = Column(String)      # 업종
    classification = Column(String) # 카드사 구분 (토스, 삼성 등)
    tag = Column(String, nullable=True) # 사용처 태그

class DocumentRecord(Base):
    __tablename__ = "document_records"
    id = Column(Integer, primary_key=True)
    target_name = Column(String)   # 대상자 (이성렬 등)
    amount_type = Column(String)   # 금액 종류 (결정세액, 보장성보험 등)
    amount = Column(Float)         # 금액
    classification = Column(String) # 서류 종류 (원천징수, 간소화 등)
    tag = Column(String, nullable=True) # 사용처 태그

SessionLocal = sessionmaker(bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)