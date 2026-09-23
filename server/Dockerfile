FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY server.js ./
ENV NODE_ENV=production
ENV PORT=8080
ENV DATA_DIR=/data
VOLUME ["/data"]
EXPOSE 8080
USER node
CMD ["node","server.js"]
