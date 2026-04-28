# 1. Use a lightweight Node.js base image
FROM node:20-alpine

# 2. Set the working directory inside the container
WORKDIR /app

# 3. Copy only package.json and package-lock.json first
COPY package*.json ./

# 4. Install dependencies (only production ones)
RUN npm install --omit=dev

# 5. Copy the rest of your application code
COPY . .

# 6. Expose the port your server runs on
EXPOSE 3000

# 7. Start the server
CMD ["node", "index.js"]