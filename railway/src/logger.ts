import pino from 'pino'
import pinoHttp from 'pino-http'
import { env } from './env'

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport:
    env.NODE_ENV === 'production'
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
          },
        },
})

export const httpLogger = pinoHttp({
  logger: logger.child({ context: 'http' }),
  redact: ['req.headers.authorization'],
} as any)

