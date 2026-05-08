from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Integer, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./data/tax_parser.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class UploadFileRecord(Base):
    __tablename__ = "upload_files"
    id = Column(String, primary_key=True) # PK: YYYYMMDDHHMMSSmmm + Random 5
    filename = Column(String, unique=True)
    upload_time = Column(DateTime, default=datetime.now)
    user_name = Column(String)  # 파일 업로드 주체
    doc_type = Column(String)   # 카드/PDF 등
    target_year = Column(String)

    cards = relationship("CardRecord", back_populates="file_info", cascade="all, delete-orphan")
    docs = relationship("DocumentRecord", back_populates="file_info", cascade="all, delete-orphan")

class CardRecord(Base):
    __tablename__ = "card_records"
    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(String, ForeignKey("upload_files.id"))
    pay_date = Column(String)
    amount = Column(Float)
    vendor = Column(String)
    user = Column(String)      # 실사용자
    tag = Column(String, default="기타")
    
    file_info = relationship("UploadFileRecord", back_populates="cards")

class DocumentRecord(Base):
    __tablename__ = "document_records"
    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(String, ForeignKey("upload_files.id"))
    target_name = Column(String)
    content = Column(String)
    tag = Column(String, default="기타")
    
    file_info = relationship("UploadFileRecord", back_populates="docs")

def init_db():
    Base.metadata.create_all(bind=engine)