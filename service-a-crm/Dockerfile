FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 4000

# Start both API and Workers. wait -n exits if either process crashes.
CMD ["bash", "-c", "npm run start:api & npm run start:workers & wait -n"]
