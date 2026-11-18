FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --chown=node:node src ./src
COPY --chown=node:node public ./public
COPY --chown=node:node database ./database
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node docker-entrypoint.sh ./
RUN npm run build
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
