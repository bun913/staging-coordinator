# Acceptance Criteria

## Basic Features
- [ ] Works as CLI tool or Docker image
- [ ] Works on both GitHub Actions and CircleCI
- [ ] Can receive configuration information via environment variables

## Schedule Management
- [ ] Can read reservation information from Google Spreadsheet
- [ ] Can retrieve product name, environment name, start datetime, end datetime, person in charge ID, person in charge name, and remarks
- [ ] Can determine if current time is within reservation period
- [ ] Can detect overlapping reservations for the same environment/product

## Slack Notifications
- [ ] Can send notifications with mentions to the person in charge when reservation is found
- [ ] Can mention multiple people in one message when there are multiple persons in charge
- [ ] Can include approval/rejection method (reactions) in notification message
- [ ] Continues release without notification when no reservation is found

## Approval Flow
- [ ] Can check Slack message reactions every 15 seconds
- [ ] Can detect configured approval reactions
- [ ] Can detect configured rejection reactions
- [ ] Can wait for up to 20 minutes (configurable)
- [ ] Can discard pipeline on timeout

## Approval Result Processing
- [ ] Continues CI when approval reaction is found (exit 0)
- [ ] Fails CI when rejection reaction is found (exit 1)
- [ ] Fails CI on timeout (exit 1)
- [ ] Can post the name of the person who approved/rejected to Slack thread

## Error Handling
- [ ] When cannot connect to Google Spreadsheet, notifies error to Slack and continues CI
- [ ] When cannot connect to Slack, outputs error log and continues CI
- [ ] When spreadsheet format is invalid, notifies error to Slack (if possible) and continues CI
- [ ] All errors do not fail CI (exit 0)

## Configuration Items
- [ ] Can read Slack Bot Token or Webhook URL from environment variables
- [ ] Can read Google Spreadsheet ID from environment variables
- [ ] Can read Google API authentication information from environment variables
- [ ] Can read notification destination Slack channel ID from environment variables
- [ ] Can read approval reaction name from environment variables (default: ok)
- [ ] Can read rejection reaction name from environment variables (default: ng)
- [ ] Can read wait time from environment variables (default: 20 minutes)

## CI Integration
- [ ] Provided in a format usable with GitHub Actions
- [ ] Provided in a format usable with CircleCI
- [ ] Can receive environment name, service name, and timezone as parameters
- [ ] CI pipeline continues even on errors (prioritize availability)

## Others
- [ ] Can perform time judgment considering timezone (default: Asia/Tokyo)
- [ ] No restrictions on approval authority (anyone can approve/reject with reactions)
- [ ] Logs are output to standard output

---

# Technical Requirements

## Architecture
- [ ] Implement as a single CLI tool
- [ ] Stateless design (no external server required)
- [ ] Monitor Slack reactions with polling method

## Required APIs
- [ ] Slack Web API
  - [ ] chat.postMessage - Message posting
  - [ ] conversations.history - Message history retrieval
  - [ ] reactions.get - Reaction retrieval
  - [ ] users.info - User information retrieval (for name display)
- [ ] Google Sheets API v4
  - [ ] spreadsheets.values.get - Sheet reading

## Implementation Language
- [ ] Implement in TypeScript
- [ ] Works in Node.js environment
- [ ] Distribute as npm package
- [ ] Executable directly with npx

## Command Line Interface
```bash
# When npm installed
staging-coordinator check \
  --env=<environment> \
  --service=<service-name> \
  --slack-token=<token> \
  --spreadsheet-id=<id> \
  --google-credentials=<json> \
  --channel-id=<channel> \
  --approve-reaction=<name> \
  --reject-reaction=<name> \
  --wait-minutes=<minutes> \
  --timezone=<tz>

# Direct execution with npx
npx staging-coordinator check \
  --env=<environment> \
  --service=<service-name> \
  # ... same options
```

## Error Handling Design
- [ ] Initialization phase (spreadsheet fetch, initial Slack post)
  - On error: Slack error notification → exit 0
- [ ] Polling phase
  - On error: Log output and continue processing
- [ ] Final result
  - Approval: exit 0
  - Rejection/timeout: exit 1

## Authentication Methods
- [ ] Slack: Bot User OAuth Token (xoxb-)
- [ ] Google: Service Account JSON credentials
- [ ] Can be specified via environment variables or command line arguments

## Logging
- [ ] Structured logs to standard output (JSON format recommended)
- [ ] Log levels: INFO, WARN, ERROR
- [ ] With timestamps

## Performance Requirements
- [ ] Startup time: within 5 seconds
- [ ] Polling interval: 15 seconds (configurable)
- [ ] Memory usage: under 100MB
- [ ] Consider API call rate limits

## Distribution Methods
- [ ] Publish to npm registry
- [ ] Support direct execution with npx
- [ ] Set bin field in package.json
- [ ] Include TypeScript build artifacts

## Testing Strategy
- [ ] Unit tests: Mock API calls
- [ ] Integration tests: Test Slack/Google accounts
- [ ] E2E tests: Testing in actual CI environment