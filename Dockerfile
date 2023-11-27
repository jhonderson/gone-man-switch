FROM node:20-alpine AS BUILD_IMAGE

WORKDIR /app

COPY package*.json ./

RUN npm install --production
RUN npm ci --omit=dev

COPY . .

RUN mkdir ./data

FROM node:20-alpine AS RUNNER_IMAGE

WORKDIR /app

LABEL org.opencontainers.image.source="https://github.com/jhonderson/gone-man-switch"

COPY --from=BUILD_IMAGE /app /app

ENV PORT=3000
ENV NODE_ENV=production

EXPOSE ${PORT}

CMD ["node", "bin/www"]
