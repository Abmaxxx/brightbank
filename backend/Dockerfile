FROM node:20-alpine
WORKDIR /app
COPY *.json ./
RUN npm ci 
COPY . .
CMD ["node" , "server.js"]
