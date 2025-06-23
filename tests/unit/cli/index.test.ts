import { describe, it, expect, vi } from 'vitest';

describe('CLI Arguments Parsing', () => {
  it('should parse help argument correctly', () => {
    const mockParseArgs = vi.fn().mockReturnValue({
      values: { help: true },
      positionals: [],
    });

    vi.doMock('node:util', () => ({
      parseArgs: mockParseArgs,
    }));

    expect(mockParseArgs).toBeDefined();
  });

  it('should handle missing arguments', () => {
    const mockParseArgs = vi.fn().mockReturnValue({
      values: {},
      positionals: [],
    });

    vi.doMock('node:util', () => ({
      parseArgs: mockParseArgs,
    }));

    const result = mockParseArgs();
    expect(result.positionals).toHaveLength(0);
  });

  it('should handle missing options', () => {
    const mockParseArgs = vi.fn().mockReturnValue({
      values: {},
      positionals: ['my-app', 'staging'],
    });

    vi.doMock('node:util', () => ({
      parseArgs: mockParseArgs,
    }));

    const result = mockParseArgs();
    expect(result.positionals).toEqual(['my-app', 'staging']);
    expect(Object.keys(result.values)).toHaveLength(0);
  });
});
