import { describe, it, expect } from 'vitest';
import {
  NetworkError,
  ValidationError,
  AuthenticationError,
  ConfigurationError,
  isNetworkError,
  isValidationError,
  isAuthenticationError,
  isConfigurationError,
} from '../../../src/utils/errors';

describe('Custom Error Types', () => {
  describe('NetworkError', () => {
    it('NetworkError - should create network error with message and cause', () => {
      const cause = new Error('Connection failed');
      const error = new NetworkError('Failed to connect to API', { cause });

      expect(error).toBeInstanceOf(NetworkError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('NetworkError');
      expect(error.message).toBe('Failed to connect to API');
      expect(error.cause).toBe(cause);
    });

    it('NetworkError - should work without cause', () => {
      const error = new NetworkError('Network timeout');

      expect(error.name).toBe('NetworkError');
      expect(error.message).toBe('Network timeout');
      expect(error.cause).toBeUndefined();
    });
  });

  describe('ValidationError', () => {
    it('ValidationError - should create validation error with field context', () => {
      const error = new ValidationError('Invalid date format', { field: 'startDateTime' });

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Invalid date format');
      expect(error.field).toBe('startDateTime');
    });

    it('ValidationError - should work without field context', () => {
      const error = new ValidationError('Validation failed');

      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Validation failed');
      expect(error.field).toBeUndefined();
    });
  });

  describe('AuthenticationError', () => {
    it('AuthenticationError - should create authentication error', () => {
      const error = new AuthenticationError('Invalid credentials');

      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.name).toBe('AuthenticationError');
      expect(error.message).toBe('Invalid credentials');
    });
  });

  describe('ConfigurationError', () => {
    it('ConfigurationError - should create configuration error with missing config', () => {
      const error = new ConfigurationError('Missing required environment variable', {
        configKey: 'GOOGLE_SPREADSHEET_ID',
      });

      expect(error).toBeInstanceOf(ConfigurationError);
      expect(error.name).toBe('ConfigurationError');
      expect(error.message).toBe('Missing required environment variable');
      expect(error.configKey).toBe('GOOGLE_SPREADSHEET_ID');
    });
  });
});

describe('Error Type Guards', () => {
  it('isNetworkError - should correctly identify NetworkError', () => {
    const networkError = new NetworkError('Network failed');
    const otherError = new Error('Generic error');

    expect(isNetworkError(networkError)).toBe(true);
    expect(isNetworkError(otherError)).toBe(false);
  });

  it('isValidationError - should correctly identify ValidationError', () => {
    const validationError = new ValidationError('Invalid input');
    const otherError = new Error('Generic error');

    expect(isValidationError(validationError)).toBe(true);
    expect(isValidationError(otherError)).toBe(false);
  });

  it('isAuthenticationError - should correctly identify AuthenticationError', () => {
    const authError = new AuthenticationError('Auth failed');
    const otherError = new Error('Generic error');

    expect(isAuthenticationError(authError)).toBe(true);
    expect(isAuthenticationError(otherError)).toBe(false);
  });

  it('isConfigurationError - should correctly identify ConfigurationError', () => {
    const configError = new ConfigurationError('Config missing');
    const otherError = new Error('Generic error');

    expect(isConfigurationError(configError)).toBe(true);
    expect(isConfigurationError(otherError)).toBe(false);
  });
});
