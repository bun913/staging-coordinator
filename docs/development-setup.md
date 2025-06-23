# Development Setup Guide

## Prerequisites

### Node.js
- **Required Version**: Node.js 18.x or higher
- **Recommended**: Latest LTS version (20.x)
- **Installation**: Use [nvm](https://github.com/nvm-sh/nvm) for version management

```bash
# Install and use Node.js LTS
nvm install --lts
nvm use --lts
```

### Package Manager
- **npm**: Version 9.x or higher (comes with Node.js 18+)
- **Alternative**: yarn 1.22.x or pnpm 8.x

## Initial Setup

### 1. Clone and Install Dependencies
```bash
git clone <repository-url>
cd staging-coordinator
npm install
```

### 2. Development Scripts
```bash
# Run tests in watch mode (use during development)
npm run test:watch

# Run tests once
npm test

# Run tests with coverage
npm run test:coverage

# Build TypeScript
npm run build

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Type check
npm run type-check
```

## Recommended VSCode Extensions

Create `.vscode/extensions.json`:
```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json",
    "ZixuanChen.vitest-explorer",
    "ms-vscode.test-adapter-converter"
  ]
}
```

## VSCode Settings

Create `.vscode/settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "vitest.enable": true
}
```

## Git Hooks Setup

### Install husky for Git hooks
```bash
npm install --save-dev husky
npx husky install
```

### Pre-commit hook
```bash
npx husky add .husky/pre-commit "npm run lint && npm run type-check"
```

### Pre-push hook
```bash
npx husky add .husky/pre-push "npm test"
```

## Development Workflow

### 1. TDD Cycle
```bash
# Start test watcher
npm run test:watch

# Write failing test first (Red)
# Write minimal code to pass test (Green)
# Refactor while keeping tests green (Refactor)
```

### 2. Code Quality Checks
```bash
# Before committing
npm run lint
npm run type-check
npm test
```

### 3. Coverage Monitoring
```bash
# Generate coverage report
npm run test:coverage

# Open coverage report in browser
open coverage/index.html
```

## Environment Variables for Development

Create `.env.example`:
```bash
# Slack Configuration
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_CHANNEL_ID=C1234567890

# Google Sheets Configuration
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SPREADSHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms

# Approval Configuration
APPROVE_REACTION=+1
REJECT_REACTION=-1
WAIT_MINUTES=20
TIMEZONE=Asia/Tokyo
```

Create `.env.local` for your actual development values (never commit this file).

## Debugging

### VSCode Debug Configuration
Create `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
      "args": ["run", "--reporter=verbose"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    },
    {
      "name": "Debug CLI",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/dist/cli/index.js",
      "args": ["check", "--env=staging", "--service=test"],
      "console": "integratedTerminal",
      "env": {
        "NODE_ENV": "development"
      }
    }
  ]
}
```

## Testing Strategy

### Unit Tests
- Location: `tests/unit/`
- Run with: `npm run test:unit`
- Coverage target: 80% branch coverage

### System Tests
- Location: `tests/system/`
- Run with: `npm run test:system`
- Requires actual API credentials

### Test Patterns
```typescript
// Test file naming: *.test.ts
// Test structure:
describe('FunctionName', () => {
  it('should do something when condition - expected result', () => {
    // Arrange
    // Act
    // Assert
  });
});
```

## Common Issues and Solutions

### Port Conflicts
If you encounter port conflicts during testing:
```bash
# Kill processes on specific port
lsof -ti:3000 | xargs kill -9
```

### Module Resolution Issues
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### TypeScript Compilation Issues
```bash
# Clean build cache
rm -rf dist
npm run build
```

## Performance Monitoring

### Build Time
```bash
# Measure build performance
time npm run build
```

### Test Performance
```bash
# Run tests with timing information
npm test -- --reporter=verbose
```

## Dependency Injection Pattern for External APIs

このプロジェクトでは、外部API（Google Sheets、Slack等）との統合において、以下のパターンを採用しています：

### 設計方針

1. **使いやすさ優先**: 本番使用時は簡単に使える
2. **テスト可能性**: 依存関係を注入してモック可能
3. **実装隠蔽**: 外部APIのラッパー実装を内部で提供

### 実装パターン

#### ❌ 避けるべきパターン（外側でゴリゴリ実装）

```typescript
// 悪い例：毎回外部でAPIラッパーを実装する必要がある
class GoogleSheetsApiImpl implements GoogleSheetsApi {
  // 毎回この実装を書く必要がある...
}

const api = new GoogleSheetsApiImpl(credentials);
const client = new GoogleSheetsClient(api, spreadsheetId, sheetName);
```

#### ✅ 推奨パターン（ファクトリー関数 + DI）

```typescript
// 1. インターフェース定義（テスト用）
export interface GoogleSheetsApi {
  getValues(spreadsheetId: string, range: string): Promise<string[][]>;
}

// 2. 具象実装を内部で提供
class GoogleSheetsApiImpl implements GoogleSheetsApi {
  // 内部実装
}

// 3. ファクトリー関数で使いやすく
interface SheetsClientConfig {
  credentials?: object;    // 本番用
  api?: GoogleSheetsApi;   // テスト用（DI）
  spreadsheetId: string;
  sheetName: string;
}

export const createSheetsClient = (config: SheetsClientConfig): SheetsClient => {
  const api = config.api || new GoogleSheetsApiImpl(config.credentials);
  return new GoogleSheetsClient(api, config.spreadsheetId, config.sheetName);
};
```

### 使用例

#### 本番での使用（簡単）

```typescript
const client = createSheetsClient({
  credentials: serviceAccountJson,
  spreadsheetId: 'your-spreadsheet-id',
  sheetName: 'Sheet1',
});

const schedules = await client.fetchSchedules();
```

#### テストでの使用（DI）

```typescript
const mockApi: GoogleSheetsApi = {
  getValues: vi.fn().mockResolvedValue([...mockData]),
};

const client = createSheetsClient({
  api: mockApi,  // モック注入
  spreadsheetId: 'test-id',
  sheetName: 'Sheet1',
});

const result = await client.fetchSchedules();
```

### このパターンの利点

1. **本番使用が簡単**: 複雑なラッパー実装を書く必要なし
2. **テストが容易**: モックの注入が簡単
3. **実装隠蔽**: 外部APIの詳細を隠蔽
4. **型安全性**: TypeScriptの恩恵を完全に受けられる

### 他のクライアント実装でも同様のパターンを採用

- SlackClient
- その他の外部API統合

全て同じパターンで実装することで、一貫性のあるAPIを提供し、開発者体験を向上させる。