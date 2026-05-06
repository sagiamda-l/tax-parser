# Tax Parser (개인 연말정산 및 소득세 자동화 시스템)

이 프로젝트는 복잡한 연말정산 및 소득세 신고 과정을 자동화하기 위한 개인용 도구입니다. 국세청 간소화 자료와 원천징수 영수증을 분석하여 개인별 세무 데이터를 정제하고 관리합니다.

## 1. 주요 기능
- **데이터 파싱:** 근로소득 원천징수영수증, 사업소득 원천징수영수증, 연말정산 간소화 PDF 데이터 추출
- **통합 관리:** 분산된 소득 및 공제 자료를 SQLite DB로 통합
- **분류 자동화:** 사용자 정의 규칙을 통한 지출 항목 카테고리 매핑
- **시각화:** 연도별 소득 추이 및 공제 현황 대시보드

## 2. 기술 스택
- **Frontend:** React
- **Backend:** Python (FastAPI 추천)
- **Database:** SQLite
- **Infrastructure:** Docker, Docker Compose

## 3. 시작하기 (Quick Start)

### 전제 조건
- Docker 및 Docker Compose 설치

### 실행 방법
1. 저장소 클론
   ```bash
   git clone [https://github.com/sagiamda-l/tax-parser.git](https://github.com/sagiamda-l/tax-parser.git)
   cd tax-parser
