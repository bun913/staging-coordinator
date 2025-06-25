# Staging Coordinator

A CLI tool to coordinate staging environment releases through Slack approval workflow. When someone tries to deploy to a staging environment, this tool checks if the environment is currently in use and requests approval from the person in charge via Slack.

## Features

- 🔍 Checks Google Sheets for scheduled staging environment usage
- 💬 Sends Slack notifications to request approval for releases
- ✅ Waits for approval/rejection via Slack reactions
- 🚦 Prevents accidental deployments during scheduled usage times
- 🤖 CI/CD friendly with environment variable support
- 📦 Available as npm package for easy integration

## Prerequisites

- Node.js >= 18.0.0
- Google Sheets API access (Service Account)
- Slack Bot with necessary permissions
- A Google Spreadsheet with schedule data

## Installation

### Quick Start (Recommended)

Use `npx` to run without installation:

```bash
npx staging-coordinator <product-name> <environment-name>
```

### Global Installation

```bash
npm install -g staging-coordinator
```

### Project Installation

```bash
npm install --save-dev staging-coordinator
```

## Usage

### Basic Usage

```bash
# Using npx (no installation required)
npx staging-coordinator my-app staging

# Using globally installed command
staging-coordinator my-app staging

# Using in npm scripts
"scripts": {
  "deploy:staging": "staging-coordinator my-app staging && npm run deploy"
}
```

### With Options

```bash
# With custom timeout
npx staging-coordinator my-app staging --wait-minutes 5

# With CI/CD (prevent self-approval)
npx staging-coordinator my-app staging --requester-user-id $GITHUB_ACTOR

# With all options via CLI
npx staging-coordinator my-app staging \
  --slack-channel-id C1234567890 \
  --slack-token xoxb-your-token \
  --spreadsheet-id 1ABC123 \
  --sheets-credentials ./credentials.json
```


## Configuration

### 1. Google Sheets Setup

#### Step 1: Create Google Cloud Project and Enable APIs
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google Sheets API:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Sheets API" 
   - Click "Enable"

#### Step 2: Create Service Account
1. Go to "IAM & Admin" > "Service Accounts"
2. Click "Create Service Account"
3. Fill in details:
   - Name: `staging-coordinator`
   - Description: `Service account for staging coordinator tool`
4. Click "Create and Continue"
5. Skip role assignment (click "Continue")
6. Click "Done"

#### Step 3: Create and Download Key
1. Click on the created service account
2. Go to "Keys" tab
3. Click "Add Key" > "Create new key"
4. Select "JSON" format
5. Download the JSON file (save as `credentials.json`)

#### Step 4: Prepare Google Spreadsheet
1. Create a new Google Spreadsheet or use existing one
2. Set up columns in this order:
   ```
   A: Product Name (e.g., "my-app", "sample-api")
   B: Environment (e.g., "staging", "production") 
   C: Start DateTime (e.g., "2025/06/23 12:00:00")
   D: End DateTime (e.g., "2025/06/23 14:00:00")
   E: Person in Charge ID (e.g., Slack user ID)
   F: Person in Charge Name (e.g., "John Doe")
   G: Remarks (e.g., "Feature testing")
   ```

3. **Sample Data Format (CSV):**
   ```csv
   Product Name,Environment,Start DateTime,End DateTime,Person in Charge ID,Person in Charge Name,Remarks
   sample-api,staging,2025/06/23 18:00:00,2025/06/23 20:00:00,U01234567,bun913,Release work
   my-app,production,2025/06/24 10:00:00,2025/06/24 12:00:00,U09876543,yamada,Emergency fix
   sample-api,staging,2025/06/25 14:00:00,2025/06/25 16:00:00,U01234567,bun913,New feature test
   ```

4. **IMPORTANT**: Share spreadsheet with service account:
   - Click "Share" button in spreadsheet
   - Enter service account email (from JSON file: `client_email`)
   - Set permission to "Editor"
   - Uncheck "Notify people"
   - Click "Share"

### 2. Slack App Setup

#### Step 1: Create Slack App
1. Go to [Slack API](https://api.slack.com/apps)
2. Click "Create New App" > "From scratch"
3. App Name: `Staging Coordinator`
4. Select your workspace

#### Step 2: Configure Bot Permissions
1. Go to "OAuth & Permissions"
2. Add Bot Token Scopes:
   - `chat:write` - Send messages
   - `reactions:read` - Read message reactions
3. Click "Install to Workspace"
4. Copy the "Bot User OAuth Token" (starts with `xoxb-`)

#### Step 3: Invite Bot to Channel
1. Go to your Slack channel
2. Type `/invite @Staging Coordinator`
3. Or add via channel settings

### 3. Environment Configuration

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:
```bash
# Slack Configuration
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token-here
SLACK_CHANNEL_ID=C1234567890  # Channel ID (not name)

# Google Sheets Configuration  
GOOGLE_SPREADSHEET_ID=1ABCDEFGHijklmnopqrstuvwxyz123456789
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'  # Full JSON content
GOOGLE_SHEET_NAME=Sheet1  # Sheet tab name

# Optional Configuration
REQUESTER_USER_ID=your-github-username  # For CI/CD
WAIT_MINUTES=20
APPROVE_REACTION=+1
REJECT_REACTION=-1

# IMPORTANT: Timezone Configuration
TIMEZONE=UTC  # REQUIRED: Must match the timezone used in your Google Spreadsheet
# Examples: UTC, Asia/Tokyo, America/New_York, Europe/London
```

### 4. Getting IDs

#### Slack Channel ID
1. In Slack, right-click on channel name
2. Select "Copy link"
3. Extract ID from URL: `https://workspace.slack.com/archives/C1234567890`
4. Channel ID is `C1234567890`

#### Spreadsheet ID  
Extract from Google Sheets URL:
```
https://docs.google.com/spreadsheets/d/1ABCDEFGHijklmnopqrstuvwxyz123456789/edit
```
Spreadsheet ID is `1ABCDEFGHijklmnopqrstuvwxyz123456789`

## Usage Examples

### CI/CD Integration

#### GitHub Actions
```yaml
- name: Check staging release approval
  run: |
    npx staging-coordinator@latest ${{ github.event.repository.name }} staging \
      --requester-user-id ${{ github.actor }} \
      --timezone UTC
  env:
    SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}
    SLACK_CHANNEL_ID: ${{ secrets.SLACK_CHANNEL_ID }}
    GOOGLE_SPREADSHEET_ID: ${{ secrets.GOOGLE_SPREADSHEET_ID }}
    GOOGLE_SERVICE_ACCOUNT_JSON: ${{ secrets.GOOGLE_SERVICE_ACCOUNT_JSON }}
    TIMEZONE: UTC  # Ensure this matches your spreadsheet timezone
```

#### CircleCI
```yaml
- run:
    name: Check staging release approval
    command: |
      npx staging-coordinator@latest ${CIRCLE_PROJECT_REPONAME} staging \
        --requester-user-id ${CIRCLE_USERNAME} \
        --timezone UTC
    environment:
      TIMEZONE: UTC
```

#### GitLab CI
```yaml
check-staging:
  script:
    - npx staging-coordinator@latest $CI_PROJECT_NAME staging --requester-user-id $GITLAB_USER_LOGIN --timezone UTC
  variables:
    TIMEZONE: UTC
```

### Manual Release Check
```bash
# Check if my-app can be released to staging (with UTC timezone)
npx staging-coordinator my-app staging --timezone UTC

# With custom timeout (5 minutes)
npx staging-coordinator my-app staging --timezone UTC --wait-minutes 5

# With different reactions and JST timezone
npx staging-coordinator my-app staging \
  --timezone Asia/Tokyo \
  --approve-reaction thumbsup \
  --reject-reaction thumbsdown
```

## Important Notes

### Timezone Configuration

**🚨 CRITICAL**: The `TIMEZONE` parameter is **REQUIRED** and must match the timezone used in your Google Spreadsheet.

- **Spreadsheet times**: When you enter `2025/06/23 14:00:00` in your spreadsheet, this tool interprets it according to the `TIMEZONE` setting
- **Mismatch consequences**: Wrong timezone settings will cause incorrect schedule matching, potentially allowing releases during restricted times
- **CI/CD environments**: Most CI/CD systems run in UTC, so ensure your spreadsheet times and timezone setting are aligned

**Examples:**
```bash
# If your spreadsheet uses JST times
npx staging-coordinator my-app staging --timezone Asia/Tokyo

# If your spreadsheet uses UTC times (recommended for global teams)
npx staging-coordinator my-app staging --timezone UTC

# If your spreadsheet uses EST times
npx staging-coordinator my-app staging --timezone America/New_York
```

## How It Works

1. **Schedule Check**: Reads Google Sheets for active schedules matching product and environment
2. **Timezone Conversion**: Interprets spreadsheet times using the specified timezone
3. **Conflict Detection**: If schedules found, sends Slack notification to stakeholders
4. **Approval Process**: Waits for ✅ (approve) or ❌ (reject) reactions
5. **Decision**: 
   - **Approved**: Exit code 0, deployment proceeds
   - **Rejected**: Exit code 1, deployment stops
   - **Timeout**: Exit code 1, deployment stops
   - **No Schedule**: Exit code 0, deployment proceeds
   - **System Error**: Exit code 0, deployment proceeds (availability-first)

## Exit Codes

- `0`: Release approved (proceed with deployment)
- `1`: Release rejected or timed out (stop deployment)

## Troubleshooting

### Common Issues

#### SSL Certificate Errors (Corporate Proxy)
```bash
# For corporate environments with proxy/firewall
NODE_TLS_REJECT_UNAUTHORIZED=0 node dist/cli/index.js my-app staging
```

#### Permission Denied (Google Sheets)
- Ensure spreadsheet is shared with service account email
- Check service account has "Editor" permission
- Verify spreadsheet ID is correct

#### Bot Not Found (Slack)
- Ensure bot is invited to the channel
- Check bot has `chat:write` and `reactions:read` permissions
- Verify channel ID is correct (not channel name)

#### Invalid Date Format
Ensure date format in spreadsheet is: `YYYY/MM/DD HH:MM:SS`
```
✅ 2025/06/23 12:00:00
❌ 2025-06-23 12:00:00
❌ 23/06/2025 12:00:00
```

#### Timezone Mismatch
- **Problem**: Schedules not detected or detected incorrectly
- **Solution**: Ensure `TIMEZONE` parameter matches your spreadsheet timezone
- **Example**: If spreadsheet uses JST times, use `--timezone Asia/Tokyo`

#### Schedule Times Not Matching
- **Problem**: Tool doesn't detect active schedules during expected times
- **Common cause**: Timezone configuration mismatch
- **Debug**: Check if current time in specified timezone matches your expectation:
  ```bash
  # Check current time in specified timezone
  node -e "console.log(new Date().toLocaleString('en-US', {timeZone: 'Asia/Tokyo'}))"
  ```

### Debug Mode

Enable verbose logging:
```bash
DEBUG=* npx staging-coordinator my-app staging
```

### Corporate Proxy Environments

For environments with self-signed certificates:
```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 npx staging-coordinator my-app staging
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode  
npm run test:watch

# Build
npm run build

# Format code
npm run format

# Lint code
npm run lint
```

## Release Process

### Creating a Release

1. **Create and push a version tag:**
   ```bash
   # For patch release (bug fixes)
   git tag v1.0.1
   git push origin v1.0.1
   
   # For minor release (new features)
   git tag v1.1.0
   git push origin v1.1.0
   
   # For major release (breaking changes)
   git tag v2.0.0
   git push origin v2.0.0
   ```

2. **Automated release process:**
   GitHub Actions will automatically:
   - Extract version from tag
   - Update package.json version
   - Run tests and lint checks
   - Build the project
   - Publish to npm registry
   - Create a PR for version update
   - Create GitHub release with changelog

3. **Post-release:**
   - Review and merge the auto-generated PR
   - The PR will update package.json and package-lock.json in main branch

### Required Setup

- `NPM_TOKEN` must be set as a GitHub secret (already configured)
- Tags must follow semantic versioning: `v[MAJOR].[MINOR].[PATCH]`

### Version Guidelines

- **Patch** (1.0.0 → 1.0.1): Bug fixes, documentation updates
- **Minor** (1.0.0 → 1.1.0): New features, backwards compatible
- **Major** (1.0.0 → 2.0.0): Breaking changes, API changes

## Documentation

- [Requirements](docs/requirements.md)
- [Acceptance Criteria](docs/acceptance-criteria.md)
- [Implementation Tasks](docs/tasks.md)
- [Development Setup](docs/development-setup.md)

## License

MIT
