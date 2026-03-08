FROM node:20-alpine

# Set working directory
WORKDIR /app

# Enable corepack for modern package managers (optional, but good practice)
RUN corepack enable

# Copy package files
COPY package*.json ./

# Install all dependencies (we need devDependencies for the build step)
RUN npm ci

# Copy the rest of the application code
COPY . .

# Run TypeScript compilation checks to prevent broken deploys
RUN npx tsc --noEmit

# Build the Vite frontend
RUN npm run build

# Expose the port the Express server runs on
EXPOSE 3001

# Start the application using tsx since server.ts is written in TypeScript
CMD ["npx", "tsx", "server.ts"]
