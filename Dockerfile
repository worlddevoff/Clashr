FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
COPY server/prisma ./server/prisma
RUN npm ci

COPY . .
RUN npx prisma generate --schema server/prisma/schema.prisma \
  && npm run build

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001
CMD ["npm", "run", "start"]
