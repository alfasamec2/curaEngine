import { z } from 'zod'

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CURA_ENGINE_BIN: z.string().default('/opt/curaengine/bin/CuraEngine'),
  CURA_ENGINE_ARGS: z.string().optional(),
  MAX_MODEL_FILE_SIZE_MB: z.coerce.number().positive().default(40),
  SLICE_TIMEOUT_SECONDS: z.coerce.number().positive().default(600),
  ALLOWED_MODEL_EXTENSIONS: z
    .string()
    .default('stl,3mf,obj,amf')
    .transform((val) =>
      val
        .split(',')
        .map((ext) => ext.trim().toLowerCase())
        .filter(Boolean)
    ),
  UPLOAD_DIR: z.string().default('/tmp/printum/uploads'),
})

const parsed = envSchema.parse(process.env)

export const env = {
  ...parsed,
  MAX_MODEL_FILE_SIZE_BYTES: parsed.MAX_MODEL_FILE_SIZE_MB * 1024 * 1024,
  BASE_ARGS: parsed.CURA_ENGINE_ARGS
    ? parsed.CURA_ENGINE_ARGS.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((token) => token.replace(/(^")|("$)/g, '')) ?? []
    : [],
}

export type Env = typeof env

