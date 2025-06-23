export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogContext {
  [key: string]: unknown;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}

interface LoggerConfig {
  level?: LogLevel;
  includeTimestamp?: boolean;
}

class StructuredLogger implements Logger {
  constructor(private readonly config: Required<LoggerConfig>) {}

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, context);
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (level < this.config.level) {
      return;
    }

    const levelName = LogLevel[level];
    const timestamp = this.config.includeTimestamp ? new Date().toISOString() : '';
    const prefix = this.config.includeTimestamp ? `${timestamp} [${levelName}]` : `[${levelName}]`;

    const logMessage = `${prefix} ${message}`;

    switch (level) {
      case LogLevel.DEBUG:
        if (context) {
          console.debug(logMessage, context);
        } else {
          console.debug(logMessage);
        }
        break;
      case LogLevel.INFO:
        if (context) {
          console.info(logMessage, context);
        } else {
          console.info(logMessage);
        }
        break;
      case LogLevel.WARN:
        if (context) {
          console.warn(logMessage, context);
        } else {
          console.warn(logMessage);
        }
        break;
      case LogLevel.ERROR:
        if (context) {
          console.error(logMessage, context);
        } else {
          console.error(logMessage);
        }
        break;
    }
  }
}

export const createLogger = (config?: LoggerConfig): Logger => {
  const defaultConfig: Required<LoggerConfig> = {
    level: LogLevel.INFO,
    includeTimestamp: true,
  };

  return new StructuredLogger({
    ...defaultConfig,
    ...config,
  });
};

// Default logger instance
export const logger = createLogger();
