FROM node:18-slim as build
WORKDIR /app

# 빌드에 필요한 도구 설치 (추가)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
# 캐시를 무시하고 깨끗하게 설치
RUN npm ci || npm install

COPY . .
RUN npm run build

# 실행용 Nginx 설정 (이전과 동일)
FROM nginx:stable-alpine
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]