# bad code has to re do every layer after copy if any of the file changes  

# FROM node:25
# WORKDIR /app
# COPY . .
# RUN npm install
# CMD ["node","server.js"]


# good image since even after editing the server file the npm packages wont get re downloaded

# FROM node:25
# WORKDIR /app
# COPY package*./ ./
# RUN npm install
# COPY . .
# CMD ["node","server.js"]


# size to big for the previous image use node:25-slim or node:25-alpine
FROM node:25-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["node","index.js"]