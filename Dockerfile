FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json .nvmrc ./
COPY . .
ENV HOST=0.0.0.0
EXPOSE 4173
CMD ["node", "server.js"]
