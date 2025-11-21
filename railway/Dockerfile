# --------------------------
# CuraEngine build stage
# --------------------------
FROM ubuntu:22.04 AS curaengine-builder

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
  build-essential \
  cmake \
  ninja-build \
  python3 \
  python3-pip \
  git \
  && rm -rf /var/lib/apt/lists/*

RUN pip3 install --no-cache-dir "conan==2.8.0"

WORKDIR /src/CuraEngine
COPY CuraEngine-main/ ./

RUN conan profile detect --force
RUN conan install . --output-folder=build --build=missing -s build_type=Release
RUN cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
RUN cmake --build build -j"$(nproc)"
RUN cmake --install build --prefix /opt/curaengine

# --------------------------
# Runtime stage
# --------------------------
FROM node:20-bullseye-slim AS runtime

ENV NODE_ENV=production \
    CURA_ENGINE_BIN=/opt/curaengine/bin/CuraEngine

RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy compiled CuraEngine
COPY --from=curaengine-builder /opt/curaengine /opt/curaengine

# Install dependencies
COPY railway/package.json railway/package-lock.json ./
RUN npm ci --omit=dev

# Copy source and build
COPY railway/tsconfig.json ./tsconfig.json
COPY railway/src ./src
RUN npm run build

EXPOSE 8080

CMD ["node", "dist/server.js"]

