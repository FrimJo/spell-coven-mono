/**
 * Structured Logger Utility
 * 
 * Provides structured logging for Cloudflare Workers with consistent format
 * Logs appear in Cloudflare dashboard and can be tailed with `wrangler tail`
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  roomId?: string;
  peerId?: string;
  messageType?: string;
  [key: string]: unknown;
}

/**
 * Structured logger that outputs JSON logs for Cloudflare Workers
 */
export class Logger {
  private context: LogContext;

  constructor(context: LogContext = {}) {
    this.context = context;
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: LogContext): Logger {
    return new Logger({ ...this.context, ...additionalContext });
  }

  /**
   * Log a debug message
   */
  debug(message: string, data?: LogContext): void {
    this.log('debug', message, data);
  }

  /**
   * Log an info message
   */
  info(message: string, data?: LogContext): void {
    this.log('info', message, data);
  }

  /**
   * Log a warning message
   */
  warn(message: string, data?: LogContext): void {
    this.log('warn', message, data);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error | unknown, data?: LogContext): void {
    const errorData: LogContext = {
      ...data,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : error,
    };
    this.log('error', message, errorData);
  }

  /**
   * Internal log method that outputs structured JSON
   */
  private log(level: LogLevel, message: string, data?: LogContext): void {
    const logEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...this.context,
      ...data,
    };

    // Use appropriate console method based on level
    switch (level) {
      case 'debug':
        console.debug(JSON.stringify(logEntry));
        break;
      case 'info':
        console.log(JSON.stringify(logEntry));
        break;
      case 'warn':
        console.warn(JSON.stringify(logEntry));
        break;
      case 'error':
        console.error(JSON.stringify(logEntry));
        break;
    }
  }
}

/**
 * Create a logger instance with optional context
 */
export function createLogger(context?: LogContext): Logger {
  return new Logger(context);
}

/**
 * Global logger instance for use throughout the application
 */
export const logger = createLogger();
