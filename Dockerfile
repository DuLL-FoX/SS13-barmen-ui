FROM node:22-alpine

WORKDIR /usr/src/app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

RUN npm run extract:drinks

ENV NODE_ENV=production
ENV PORT=24322

EXPOSE 24322

CMD ["node", "src/server.js"]
