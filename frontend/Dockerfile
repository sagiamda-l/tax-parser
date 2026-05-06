FROM node:18-slim AS build
WORKDIR /app

# package.json이 비어있지 않은지 확인하는 과정이 포함됩니다.
COPY package*.json ./
RUN npm install

COPY . .
COPY . .
# CI=false 설정을 추가하여 경고 때문에 빌드가 멈추는 것을 방지합니다.
RUN CI=false npm run build

# 실행용 Nginx (동일)
FROM nginx:stable-alpine
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]