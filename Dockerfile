FROM oven/bun:latest

WORKDIR /app

COPY package.json bun.lock* ./
RUN apt-get update && apt-get install -y ffmpeg git && rm -rf /var/lib/apt/lists/*
RUN ffmpeg -encoders 2>/dev/null | grep -q opus || (echo "ffmpeg opus encoder missing" && exit 1)
RUN bun install --frozen-lockfile

COPY tsconfig.json tsconfig.bot.json next.config.mjs ./
COPY src ./src
COPY app ./app
RUN bun run build
RUN bunx next build

RUN rm -rf node_modules && bun install --frozen-lockfile --production

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3995

CMD ["sh", "docker-entrypoint.sh"]
