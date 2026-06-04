FROM node:20-alpine

WORKDIR /app

# Installe les dépendances
COPY package*.json ./
RUN npm install

# Copie le code source
COPY . .

# Variables d'environnement pour la compilation Next.js
ENV NODE_ENV=production

# Compile le projet Next.js
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
