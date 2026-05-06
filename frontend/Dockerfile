FROM node:18-slim AS build
WORKDIR /app

# package.json이 비어있지 않은지 확인하는 과정이 포함됩니다.
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# 실행용 Nginx (동일)
FROM nginx:stable-alpine
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]