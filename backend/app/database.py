from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Integer, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

# DB 경로 및 엔진 설정
SQLALCHEMY_DATABASE_URL = "sqlite:///./data/tax_parser.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class UploadFileRecord(Base):
    __tablename__ = "upload_files"
    # PK 규칙: YYYYMMDDHHMMSSmmm + Random 5
    id = Column(String, primary_key=True)
    filename = Column(String, unique=True)
    customer = Column(String)  # 이용자명 (추가)
    upload_date = Column(DateTime, default=datetime.datetime.utcnow)
    target_year = Column(String)

    # 상위 파일 삭제 시 하위 내역 자동 삭제 (Cascade)
    cards = relationship("CardRecord", back_populates="file_info", cascade="all, delete-orphan")

class CardRecord(Base):
    __tablename__ = "card_records"
    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(String, ForeignKey("upload_files.id"))
    pay_date = Column(String)
    amount = Column(Float)
    vendor = Column(String)
    tag = Column(String, default="기타") # 9가지 경비 항목 중 하나
    
    file_info = relationship("UploadFileRecord", back_populates="cards")

def init_db():
    Base.metadata.create_all(bind=engine)