export class NetworkError extends Error {
  readonly name = 'NetworkError';
  readonly cause?: Error;

  constructor(message: string, options?: { cause?: Error }) {
    super(message);
    this.cause = options?.cause;
  }
}

export class ValidationError extends Error {
  readonly name = 'ValidationError';
  readonly field?: string;

  constructor(message: string, options?: { field?: string }) {
    super(message);
    this.field = options?.field;
  }
}

export class AuthenticationError extends Error {
  readonly name = 'AuthenticationError';
}

export class ConfigurationError extends Error {
  readonly name = 'ConfigurationError';
  readonly configKey?: string;

  constructor(message: string, options?: { configKey?: string }) {
    super(message);
    this.configKey = options?.configKey;
  }
}

// Type guards
export const isNetworkError = (error: unknown): error is NetworkError =>
  error instanceof NetworkError;

export const isValidationError = (error: unknown): error is ValidationError =>
  error instanceof ValidationError;

export const isAuthenticationError = (error: unknown): error is AuthenticationError =>
  error instanceof AuthenticationError;

export const isConfigurationError = (error: unknown): error is ConfigurationError =>
  error instanceof ConfigurationError;
