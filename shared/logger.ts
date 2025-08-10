/**
 * Universal Logger based on Pino
 * Works in both browser and Node.js environments
 */

import type { Logger as PinoLogger } from 'pino';
import pino from 'pino';

/**
 * Log levels mapping (compatible with Pino standard levels)
 */
export const LOG_LEVELS = {
  silent: 0,
  error: 10,
  warn: 20,
  info: 30,
  debug: 40,
  trace: 50,
} as const;

export type TLogLevel = keyof typeof LOG_LEVELS;

/**
 * Environment detection
 */
export interface IEnvironment {
  isBrowser: boolean;
  isNode: boolean;
  isDevelopment: boolean;
  isProduction: boolean;
}

export function getEnvironment(): IEnvironment {
  // Safe browser detection for universal usage
  const isBrowser =
    typeof globalThis !== 'undefined' && 'window' in globalThis && 'document' in globalThis;
  const isNode =
    typeof globalThis !== 'undefined' &&
    'process' in globalThis &&
    !!(globalThis as { process?: { versions?: { node?: string } } }).process?.versions?.node;

  const nodeProcess = (globalThis as { process?: NodeJS.Process }).process;

  return {
    isBrowser,
    isNode,
    isDevelopment: nodeProcess?.env?.NODE_ENV === 'development',
    isProduction: nodeProcess?.env?.NODE_ENV === 'production',
  };
}

/**
 * Get log level from environment variables
 */
export function getLogLevel(serviceName: string): TLogLevel {
  const env = getEnvironment();

  // Try service-specific level first
  const serviceKey = `LOG_LEVEL_${serviceName.toUpperCase()}`;
  const serviceLevel = env.isBrowser
    ? (globalThis as { window?: { __NEXT_PUBLIC_ENV__?: Record<string, string> } }).window
        ?.__NEXT_PUBLIC_ENV__?.[`NEXT_PUBLIC_${serviceKey}`]
    : (globalThis as { process?: NodeJS.Process }).process?.env?.[serviceKey];

  if (serviceLevel && serviceLevel in LOG_LEVELS) {
    return serviceLevel as TLogLevel;
  }

  // Fallback to general level
  const generalLevel = env.isBrowser
    ? (globalThis as { window?: { __NEXT_PUBLIC_ENV__?: Record<string, string> } }).window
        ?.__NEXT_PUBLIC_ENV__?.NEXT_PUBLIC_LOG_LEVEL
    : (globalThis as { process?: NodeJS.Process }).process?.env?.LOG_LEVEL;

  if (generalLevel && generalLevel in LOG_LEVELS) {
    return generalLevel as TLogLevel;
  }

  // Default level based on environment
  return env.isDevelopment ? 'debug' : 'info';
}

/**
 * Create Pino configuration
 */
function createPinoConfig(serviceName?: string, level: TLogLevel = 'info') {
  const env = getEnvironment();

  const baseConfig = {
    name: serviceName ? `${serviceName}Service` : 'app',
    level,
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  if (env.isBrowser) {
    // Browser configuration
    return {
      ...baseConfig,
      browser: {
        write: {
          info: console.info.bind(console),
          warn: console.warn.bind(console),
          error: console.error.bind(console),
          debug: console.debug.bind(console),
          trace: console.trace.bind(console),
        },
        serialize: true,
      },
    };
  } else {
    // Node.js configuration
    return {
      ...baseConfig,
      transport: env.isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'yyyy-mm-dd HH:MM:ss.l',
              ignore: 'pid,hostname',
              messageFormat: '[{name}] {msg}',
            },
          }
        : undefined,
    };
  }
}

/**
 * Universal Logger wrapper around Pino
 */
export class UniversalLogger {
  private _pino: PinoLogger;
  private _serviceName?: string;

  constructor(serviceName?: string, level?: TLogLevel) {
    this._serviceName = serviceName;
    const logLevel = level || getLogLevel(serviceName || 'general');
    this._pino = pino(createPinoConfig(serviceName, logLevel));
  }

  /**
   * Core logging methods
   */
  error(message: string, meta?: Record<string, unknown>): void;
  error(error: Error, message?: string, meta?: Record<string, unknown>): void;
  error(
    msgOrError: string | Error,
    messageOrMeta?: string | Record<string, unknown>,
    meta?: Record<string, unknown>
  ): void {
    if (msgOrError instanceof Error) {
      const error = msgOrError;
      const message = typeof messageOrMeta === 'string' ? messageOrMeta : error.message;
      const finalMeta = typeof messageOrMeta === 'object' ? messageOrMeta : meta;

      this._pino.error({ err: error, ...finalMeta }, message);
    } else {
      const message = msgOrError;
      const finalMeta = messageOrMeta as Record<string, unknown>;
      this._pino.error(finalMeta, message);
    }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this._pino.warn(meta, message);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this._pino.info(meta, message);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this._pino.debug(meta, message);
  }

  trace(message: string, meta?: Record<string, unknown>): void {
    this._pino.trace(meta, message);
  }

  /**
   * Create child logger with additional context
   */
  child(context: Record<string, unknown>): UniversalLogger {
    const childLogger = new UniversalLogger(this._serviceName);
    childLogger._pino = this._pino.child(context);
    return childLogger;
  }

  /**
   * Set log level dynamically
   */
  setLevel(level: TLogLevel): void {
    this._pino.level = level;
  }

  /**
   * Get current log level
   */
  getLevel(): string {
    return this._pino.level;
  }

  /**
   * Check if level is enabled
   */
  isLevelEnabled(level: TLogLevel): boolean {
    return this._pino.isLevelEnabled(level);
  }

  /**
   * Get underlying Pino instance for advanced usage
   */
  getPinoInstance(): PinoLogger {
    return this._pino;
  }
}

/**
 * Logger Factory for creating service-specific loggers
 */
export class LoggerFactory {
  private static _defaultLevel: TLogLevel = 'info';
  private static _fileTransports: Array<{ target: string; options: unknown }> = [];

  /**
   * Set default log level for all new loggers
   */
  static setDefaultLevel(level: TLogLevel): void {
    LoggerFactory._defaultLevel = level;
  }

  /**
   * Add file transport (Node.js only)
   * This method allows adding file logging without implementing it now
   */
  static addFileTransport(target: string, options: unknown): void {
    const env = getEnvironment();
    if (env.isNode) {
      LoggerFactory._fileTransports.push({ target, options });
    }
  }

  /**
   * Create service logger
   */
  static createServiceLogger(serviceName: string, level?: TLogLevel): UniversalLogger {
    const logLevel = level || getLogLevel(serviceName);
    return new UniversalLogger(serviceName, logLevel);
  }

  /**
   * Create general logger
   */
  static createLogger(name?: string, level?: TLogLevel): UniversalLogger {
    return new UniversalLogger(name, level || LoggerFactory._defaultLevel);
  }

  /**
   * Create logger with file transport (Node.js only)
   * Future: This will be used to add Winston file transports
   */
  static createLoggerWithFileTransport(
    serviceName: string,
    fileOptions?: unknown
  ): UniversalLogger {
    const env = getEnvironment();
    const logger = LoggerFactory.createServiceLogger(serviceName);

    if (env.isNode && fileOptions) {
      // Future: Add file transport configuration
      // This is where we'll integrate with Winston file transports
      console.info(`File transport would be added for ${serviceName}`, fileOptions);
    }

    return logger;
  }
}

/**
 * Pre-configured service loggers
 */
export const serviceLoggers = {
  fs: LoggerFactory.createServiceLogger('FS'),
  telegram: LoggerFactory.createServiceLogger('Telegram'),
  sync: LoggerFactory.createServiceLogger('Sync'),
  storage: LoggerFactory.createServiceLogger('Storage'),
  socket: LoggerFactory.createServiceLogger('Socket'),
  scheduler: LoggerFactory.createServiceLogger('Scheduler'),
  api: LoggerFactory.createServiceLogger('API'),
} as const;

/**
 * Main logger instance
 */
export const logger = LoggerFactory.createLogger('main');

export default logger;
