FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json .nvmrc ./
COPY . .
EXPOSE 4173
CMD ["node", "server.js"]
