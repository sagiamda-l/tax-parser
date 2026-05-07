FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y gcc && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

ARG BUILD_DATE=unknown
ENV APP_BUILD_DATE=$BUILD_DATE

# 서버 시작 시 빌드 시간 출력하도록 설정 (main.py에서 해도 됨)
CMD ["sh", "-c", "echo 'Build Date: '$APP_BUILD_DATE && uvicorn app.main:app --host 0.0.0.0 --port 8000"]