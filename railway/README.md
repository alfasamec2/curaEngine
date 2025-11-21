# Railway CuraEngine Service

This folder contains a self-hostable microservice that wraps **CuraEngine** with a lightweight HTTP API.  
The intended workflow is:

1. Build and deploy the service to Railway using this folder as the root for that service.
2. Expose the `/slice` endpoint to the main Printum app so the “Prepare to Print” flow can request a G-code slice.
3. Configure environment variables for things like Cura profiles, base arguments, and storage locations.

## Directory layout

```
railway/
├── Dockerfile            # Multi-stage build (compiles CuraEngine, then runs the Node service)
├── README.md             # You are here
├── package.json          # Express/TypeScript service definition
├── package-lock.json     # Locked dependencies for deterministic builds
├── tsconfig.json         # TypeScript compiler settings
├── .dockerignore         # Keeps Docker context slim
├── railway.toml          # Railway metadata (builder + health check)
└── src/
    ├── env.ts            # Environment variable parsing & defaults
    ├── logger.ts         # Pino logger shared by the service
    ├── slicer.ts         # Helper that shells out to CuraEngine
    └── server.ts         # Express API (health + /slice)
```

## API surface

| Method | Path     | Description                                                                                               |
| ------ | -------- | --------------------------------------------------------------------------------------------------------- |
| GET    | `/health`| Returns `{ status, curaEngine, binary }` and ensures the CuraEngine binary is reachable.                  |
| POST   | `/slice` | `multipart/form-data` accepting **model** (STL/3MF/OBJ/AMF) and optional `settings` JSON. Returns G-code. |

### Example request

```bash
curl -X POST https://<railway-app>.up.railway.app/slice \
  -F model=@benchy.stl \
  -F 'settings={"layer_height":0.2,"wall_line_count":3}' \
  --output benchy.gcode
```

## Environment variables

| Name                     | Default                               | Description                                                                     |
| ------------------------ | ------------------------------------- | ------------------------------------------------------------------------------- |
| `PORT`                   | `8080`                                | HTTP port. Railway will override automatically.                                 |
| `CURA_ENGINE_BIN`        | `/opt/curaengine/bin/CuraEngine`      | Absolute path to the compiled CuraEngine binary.                                |
| `CURA_ENGINE_ARGS`       | *(empty)*                             | Space-separated default arguments (e.g. `-v 0 -j 4`). Quoted values are honored. |
| `MAX_MODEL_FILE_SIZE_MB` | `40`                                  | Upload limit enforced by Multer.                                                |
| `SLICE_TIMEOUT_SECONDS`  | `600`                                 | Max time a single slice job can run before it is aborted.                       |
| `ALLOWED_MODEL_EXTENSIONS` | `stl,3mf,obj,amf`                   | Comma-separated whitelist for incoming models.                                  |
| `UPLOAD_DIR`             | `/tmp/printum/uploads`                | Where temporary uploads are written inside the container.                       |

## Local development

```bash
cd railway
npm install
npm run dev
```

This runs the Express API with live reload (`tsx watch`). For production/Railway the Dockerfile handles `npm run build` followed by `npm start`.

## Docker / Railway

1. Railway detects `railway/Dockerfile` and builds with it (multi-stage build).
2. Stage 1 compiles CuraEngine directly from the checked-in `CuraEngine-main` folder via Conan/CMake.
3. Stage 2 copies the compiled binary plus the Node service, installs only production dependencies, and runs `node dist/server.js`.

Health checks hit `/health`, and unsuccessful slice jobs are automatically cleaned up to avoid filling disk space.

