from sqlalchemy import Column, Integer, DateTime, ForeignKey, String, Float, Date, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm import relationship
from datetime import datetime
import os, random
basedir = os.path.abspath(os.path.dirname(__file__))
print("Basedir:", basedir)
engine = create_engine('sqlite:///' + os.path.join(basedir, '../data/tax_parser.db'))

Base = declarative_base()

class UploadFileRecord(Base):
    __tablename__ = "upload_files"
    # PK: 연월일시분초밀리초(17자리) + 랜덤5자리
    id = Column(String, primary_key=True)
    filename = Column(String, unique=True)
    upload_time = Column(DateTime, default=datetime.now)
    user_name = Column(String)  # 이용자
    doc_type = Column(String)   # 문서종류
    target_year = Column(String) # 대상년도

    # 관계 설정
    cards = relationship("CardRecord", back_populates="file_info", cascade="all, delete-orphan")
    docs = relationship("DocumentRecord", back_populates="file_info", cascade="all, delete-orphan")

class CardRecord(Base):
    __tablename__ = "card_records"
    id = Column(Integer, primary_key=True)
    file_id = Column(String, ForeignKey("upload_files.id"))
    pay_date = Column(String)      # 결제일
    amount = Column(Float)         # 결제금액
    vendor = Column(String)        # 업체명
    biz_no = Column(String)        # 사업자번호
    industry = Column(String)      # 업종
    classification = Column(String) # 카드사 구분 (토스, 삼성 등)
    user = Column(String) # [추가] 카드 사용자
    tag = Column(String, nullable=True) # 사용처 태그
    file_info = relationship("UploadFileRecord", back_populates="cards")

class DocumentRecord(Base):
    __tablename__ = "document_records"
    id = Column(Integer, primary_key=True)
    file_id = Column(String, ForeignKey("upload_files.id"))
    target_name = Column(String)   # 대상자 (이성렬 등)
    amount_type = Column(String)   # 금액 종류 (결정세액, 보장성보험 등)
    amount = Column(Float)         # 금액
    classification = Column(String) # 서류 종류 (원천징수, 간소화 등)
    tag = Column(String, nullable=True) # 사용처 태그
    file_info = relationship("UploadFileRecord", back_populates="docs")

SessionLocal = sessionmaker(bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)