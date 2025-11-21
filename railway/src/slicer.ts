import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { env } from './env'
import { logger } from './logger'

export interface SliceOptions {
  modelPath: string
  jobLabel?: string
  settings?: Record<string, string | number | boolean>
}

export interface SliceResult {
  outputPath: string
  stdout: string
  stderr: string
}

export async function sliceModel({ modelPath, jobLabel, settings }: SliceOptions): Promise<SliceResult> {
  const jobId = jobLabel?.replace(/\s+/g, '_') || randomUUID()
  const workingDir = path.dirname(modelPath)
  const outputPath = path.join(workingDir, `${jobId}.gcode`)

  const args = [...env.BASE_ARGS]

  if (settings) {
    for (const [key, value] of Object.entries(settings)) {
      if (value === undefined || value === null || value === '') continue
      args.push('-s', `${key}=${value}`)
    }
  }

  args.push('-o', outputPath, modelPath)

  logger.debug({ args, jobId }, 'Starting CuraEngine job')

  const child = spawn(env.CURA_ENGINE_BIN, args, {
    cwd: workingDir,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: env.SLICE_TIMEOUT_SECONDS * 1000,
  })

  let stdout = ''
  let stderr = ''

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString()
  })

  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString()
  })

  const exitCode: number = await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('close', resolve)
  })

  if (exitCode !== 0) {
    logger.error({ exitCode, stderr }, 'CuraEngine failed')
    await safeUnlink(outputPath)
    throw new Error(`CuraEngine exited with code ${exitCode}`)
  }

  return {
    outputPath,
    stdout,
    stderr,
  }
}

export async function ensureUploadDir(): Promise<void> {
  await fs.mkdir(env.UPLOAD_DIR, { recursive: true })
}

export async function safeUnlink(target?: string | null) {
  if (!target) return
  try {
    await fs.unlink(target)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.warn({ error, target }, 'Failed to delete temp file')
    }
  }
}

