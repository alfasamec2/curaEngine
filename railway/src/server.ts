import cors from 'cors'
import express from 'express'
import multer from 'multer'
import path from 'node:path'
import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import type { Request, Response, NextFunction } from 'express'
import { env } from './env'
import { ensureUploadDir, safeUnlink, sliceModel } from './slicer'
import { httpLogger, logger } from './logger'

const allowedExtensions = new Set(env.ALLOWED_MODEL_EXTENSIONS)

const upload = multer({
  dest: env.UPLOAD_DIR,
  limits: {
    fileSize: env.MAX_MODEL_FILE_SIZE_BYTES,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).replace('.', '').toLowerCase()
    if (!allowedExtensions.has(ext)) {
      return cb(new Error(`Unsupported file extension ".${ext}". Allowed: ${[...allowedExtensions].join(', ')}`))
    }
    cb(null, true)
  },
})

const app = express()
app.disable('x-powered-by')
app.use(httpLogger)
app.use(cors())
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))

app.get('/health', async (_req, res) => {
  try {
    await fs.access(env.CURA_ENGINE_BIN)
    res.json({
      status: 'ok',
      curaEngine: 'ready',
      binary: env.CURA_ENGINE_BIN,
    })
  } catch (error) {
    res.status(503).json({
      status: 'error',
      curaEngine: 'missing',
      message: (error as Error).message,
    })
  }
})

app.post('/slice', upload.single('model'), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Model file is required (field name "model")' })
  }

  let parsedSettings: Record<string, string | number | boolean> | undefined
  if (req.body?.settings) {
    try {
      parsedSettings = typeof req.body.settings === 'string' ? JSON.parse(req.body.settings) : req.body.settings
    } catch (error) {
      await safeUnlink(req.file.path)
      return res.status(400).json({ error: 'Invalid JSON payload in "settings"', details: (error as Error).message })
    }
  }

  try {
    const result = await sliceModel({
      modelPath: req.file.path,
      jobLabel: req.body?.jobLabel,
      settings: parsedSettings,
    })

    res.setHeader('Content-Type', 'text/plain')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${req.body?.jobLabel ?? path.parse(req.file.originalname).name}.gcode"`
    )
    const stream = createReadStream(result.outputPath)
    stream.pipe(res)
    stream.once('close', async () => {
      await safeUnlink(req.file?.path)
      await safeUnlink(result.outputPath)
    })
  } catch (error) {
    await safeUnlink(req.file.path)
    next(error)
  }
})

// Error handler
app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err: error }, 'Unhandled error')
  const status = 'status' in error ? (error as any).status : 500
  res.status(status).json({
    error: error.message ?? 'Unexpected error',
  })
})

async function bootstrap() {
  await ensureUploadDir()
  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'CuraEngine service listening')
  })
}

bootstrap().catch((error) => {
  logger.error({ err: error }, 'Failed to boot service')
  process.exit(1)
})

