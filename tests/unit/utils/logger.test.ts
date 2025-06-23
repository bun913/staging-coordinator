import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LogLevel, createLogger } from '../../../src/utils/logger';

describe('Logger', () => {
  let mockConsole: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Mock console methods
    mockConsole = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    vi.stubGlobal('console', mockConsole);
  });

  describe('createLogger', () => {
    it('createLogger - should create logger with default settings', () => {
      const logger = createLogger();

      expect(logger).toBeDefined();
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });

    it('createLogger - should create logger with custom log level', () => {
      const logger = createLogger({ level: LogLevel.WARN });

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');

      expect(mockConsole.debug).not.toHaveBeenCalled();
      expect(mockConsole.info).not.toHaveBeenCalled();
      expect(mockConsole.warn).toHaveBeenCalledWith(expect.stringContaining('[WARN] Warn message'));
    });
  });

  describe('logging methods', () => {
    it('logger.debug - should log debug message with context', () => {
      const logger = createLogger({ level: LogLevel.DEBUG });

      logger.debug('Debug message', { userId: 'U123', function: 'fetchData' });

      expect(mockConsole.debug).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG] Debug message'),
        expect.objectContaining({ userId: 'U123', function: 'fetchData' })
      );
    });

    it('logger.info - should log info message', () => {
      const logger = createLogger({ level: LogLevel.INFO });

      logger.info('Info message');

      expect(mockConsole.info).toHaveBeenCalledWith(expect.stringContaining('[INFO] Info message'));
    });

    it('logger.warn - should log warning message', () => {
      const logger = createLogger({ level: LogLevel.WARN });

      logger.warn('Warning message');

      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('[WARN] Warning message')
      );
    });

    it('logger.error - should log error message with error object', () => {
      const logger = createLogger({ level: LogLevel.ERROR });
      const error = new Error('Test error');

      logger.error('Error occurred', { error });

      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] Error occurred'),
        expect.objectContaining({ error })
      );
    });
  });

  describe('log level filtering', () => {
    it('should filter logs below the configured level', () => {
      const logger = createLogger({ level: LogLevel.WARN });

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');

      expect(mockConsole.debug).not.toHaveBeenCalled();
      expect(mockConsole.info).not.toHaveBeenCalled();
      expect(mockConsole.warn).toHaveBeenCalled();
      expect(mockConsole.error).toHaveBeenCalled();
    });
  });

  describe('timestamp formatting', () => {
    it('should include timestamp in log output', () => {
      const logger = createLogger({ level: LogLevel.INFO });

      logger.info('Test message');

      const logCall = mockConsole.info.mock.calls[0][0];
      expect(logCall).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
    });
  });
});
