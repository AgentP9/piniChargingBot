FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy application files
COPY *.js ./

# Create data directory for persistent storage
RUN mkdir -p /app/data

# Declare volume for data persistence
VOLUME ["/app/data"]

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
