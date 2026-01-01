import winston from 'winston';
import * as path from 'path';

const logDir = process.env.LOG_DIR || 'logs';
const logLevel = process.env.LOG_LEVEL || 'info';

/**
 * Custom log format
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

/**
 * Console format for development
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level}] ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  })
);

/**
 * Create logger instance
 */
export const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  defaultMeta: { service: 'legito-api-tests' },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: consoleFormat,
    }),
    // Write all logs to file
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
    }),
  ],
});

/**
 * Create a child logger with additional metadata
 */
export function createChildLogger(metadata: Record<string, any>): winston.Logger {
  return logger.child(metadata);
}

/**
 * Log test execution start
 */
export function logTestStart(testName: string, metadata?: Record<string, any>): void {
  logger.info(`Starting test: ${testName}`, metadata);
}

/**
 * Log test execution end
 */
export function logTestEnd(
  testName: string,
  duration: number,
  status: 'passed' | 'failed' | 'skipped'
): void {
  const level = status === 'failed' ? 'error' : 'info';
  logger.log(level, `Test ${status}: ${testName}`, { duration, status });
}

/**
 * Log API request
 */
export function logApiRequest(
  method: string,
  url: string,
  metadata?: Record<string, any>
): void {
  logger.debug(`API Request: ${method} ${url}`, metadata);
}

/**
 * Log API response
 */
export function logApiResponse(
  method: string,
  url: string,
  status: number,
  duration: number
): void {
  logger.debug(`API Response: ${method} ${url} - ${status}`, { status, duration });
}

/**
 * Sanitize sensitive data from logs
 */
export function sanitize(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const sanitized = { ...data };
  const sensitiveKeys = ['password', 'token', 'authorization', 'apiKey', 'secret'];

  for (const key in sanitized) {
    if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitize(sanitized[key]);
    }
  }

  return sanitized;
}

// Create logs directory if it doesn't exist
if (typeof window === 'undefined') {
  const fs = require('fs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
}
