FROM node:22-alpine

WORKDIR /usr/src/app

COPY package.json package-lock.json ./

COPY client/package.json client/package-lock.json ./client/

RUN npm ci

RUN cd client && npm ci

ARG CACHEBUST=1
COPY . .

RUN npm run extract:drinks

RUN cd client && npm run build

ENV NODE_ENV=production
ENV PORT=24322

EXPOSE 24322

CMD ["node", "src/server.js"]
