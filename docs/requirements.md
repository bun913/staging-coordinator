# Staging Environment Coordinator Requirements

## Background

### Current Issues
- Many companies have staging environments for testing
- When multiple development projects are running in parallel, someone may unknowingly release a specific branch
- This can disrupt other teams' testing work or cause unexpected issues

### What We Want to Solve
- Prevent release conflicts
- Avoid strict constraints that forcibly stop releases
- Want a flexible notification/confirmation system that asks "Someone is trying to release this, is it okay?"

## Requirements

### Basic Mechanism
- Record the following information in a schedule management system (e.g., Google Spreadsheet)
  - Product name
  - Environment name
  - Desired usage time
  - Person in charge
- Send notification when a release is attempted for that environment/product during the scheduled time

### Notification System
- Mention the person in charge in a specific Slack workspace
- Send a confirmation message asking "Is it okay to execute this release?"

### Cost Considerations
- Want to minimize costs
- Google Spreadsheet is mentioned as an example because it's free and easy to edit
- No particular preference for data store (database is also fine)

## Detailed Usage Example

### CI/CD Pipeline Implementation Example
```yaml
- release-checker
  - env: staging
  - service: serviceA
  - timeZone: Asia/Tokyo
  - waitMinutes: 20
- release
  - env: staging
```

### Operation Flow
1. `release-checker` step is executed
2. Search for the person in charge from the schedule management system based on environment (staging) and service (serviceA) information
3. Send notification with mention to the person in charge on Slack
4. Check message reactions every 15 seconds for up to 20 minutes
5. If approval reaction (configured) is found: proceed to `release` step
6. If rejection reaction (configured) is found: CI fails immediately
7. If no reaction (timeout): pipeline is discarded

### Slack Notification Content
- Information about the environment and service being released
- Instructions for approval (approve/reject with configured reactions)
- Remaining time until timeout

## Technical Requirements

### Implementation Strategy
- Implement as a single CLI tool
- Works with the same command on any CI/CD service
- Implement with polling method without webhook server (prioritize simplicity)
- Manage maximum wait time within the tool (not dependent on CI timeout)

## Schedule Management Details

### Time Period Specification Method
- Manage with two fields: start datetime and end datetime
- Format example: 
  - Start datetime: 2024/01/15 10:00
  - End datetime: 2024/01/15 18:00
- Can be specified in minute units
- Periodic reservations are not required (register each time)

### Spreadsheet Fields
- Product name
- Environment name
- Start datetime
- End datetime
- Person in charge ID (Slack user ID e.g.: U1234ABCD)
- Person in charge name (human-readable name)
- Remarks (usage purpose, etc.)

### Handling Overlapping Reservations
- If there are overlapping reservations for the same environment/product, notify both persons in charge
- Overlaps are basically treated as abnormal conditions
- Unnecessary reservations should be deleted from the spreadsheet by the person in charge
- Mention everyone in one Slack message (including multiple mentions)
- If any one person approves, the release can continue

### Handling When No Reservation Found
- If no reservation at the relevant time, continue release without notification

## Permission Management

### Approval Authority
- Anyone can press the approve/reject buttons in Slack notifications
- People other than the person in charge can also approve (for handling when the person in charge is absent)
- Strict permission management is not required

## Error Case Handling

### Basic Policy
- If error occurs during initial processing (spreadsheet fetch, Slack post), send error notification and exit successfully (exit 0)
- Ignore errors during polling and continue processing
- Notify error details to Slack and then continue release (prioritize availability)

### Specific Error Cases
1. **Cannot connect to Google Spreadsheet**
   - Post error details to Slack
   - CI continues without error

2. **Cannot connect to Slack/Cannot send notification**
   - Record error log if possible
   - CI continues without error

3. **Spreadsheet format is broken**
   - Post error details to Slack (if possible)
   - CI continues without error

## Operational Requirements

### Log and History Management
- Approval/rejection history is recorded in Slack thread
- Display the name of the person who pressed the button in the format "○○ approved"
- No separate log storage required

### Notification Destination Settings
- All notifications (approval requests, error notifications) are sent to the same Slack channel
- Channel is specified by environment variable

### Configuration Management
- Sensitive information is managed as CI environment variables/secrets
  - Slack Webhook URL or Bot Token
  - Google Spreadsheet ID
  - Google API authentication information
  - Notification destination Slack channel ID
  - Approval reaction name (e.g., ok, +1, etc.)
  - Rejection reaction name (e.g., ng, -1, etc.)

## Testing Strategy

### Test Design Principles
- Design all code to be testable
- Abstract external dependencies with proper interfaces
- Maximize use of TypeScript type system
- Proceed with implementation using TDD

### Directory Structure
```
tests/
├── unit/      # Fast unit tests
└── system/    # System tests using actual APIs
```

### Unit Tests
- **Test Framework**: Vitest
- **Coverage Goal**: Branch coverage (C1) 80% or higher
- **Execution Method**: Always run in watch mode during development
- **Mocking Strategy**:
  - Mock external APIs (Slack, Google Sheets)
  - Use mocks to verify contracts (request parameters, URLs, headers, etc.)
  - Avoid self-fulfilling response tests

### Test Writing Rules
- Use `it` (not `test`)
- `it` title format:
  ```typescript
  it('function name - scenario - expected behavior', () => {
    // Example: fetchSchedule - when reservation exists - returns array of reservation objects
  });
  ```
- Group SUT with `describe`

### Interface Design
- Don't use external library types directly
- Define custom interfaces for dependency injection
- Example:
  ```typescript
  // Bad
  function postMessage(client: WebClient, message: string) {}
  
  // Good
  interface SlackClient {
    postMessage(channel: string, message: string): Promise<void>;
  }
  function postMessage(client: SlackClient, message: string) {}
  ```

### System Tests
- **Execution Timing**: Manually run before release
- **Environment**: Use test Slack/Google accounts
- **Purpose**: Verify actual API integration
- **Note**: Don't run in CI/CD (manual execution only)

### CI/CD Integration
- Automatically run unit tests on push
- Comment coverage report on PR
- System tests are manually triggered

## Architecture Design

### 🔴 Most Important Principle: Incremental Implementation with TDD
- **Don't implement multiple features at once**
- **Carefully implement one function at a time with TDD**
- **Strictly follow Red → Green → Refactor cycle**
- **Completely finish current function before moving to the next**
- **Don't rush, be steady, prioritize quality**

### Design Principles
- **Prioritize simplicity**
  - Avoid over-abstraction
  - Minimal necessary structure
- **Utilize functional programming**
  - Prefer pure functions
  - Error handling with Result type
  - Immutable data

### Directory Structure
```
src/
├── lib/              # Core pure functions
│   ├── schedule.ts   # Schedule-related logic
│   ├── slack.ts      # Slack communication wrapper
│   ├── sheets.ts     # Google Sheets wrapper
│   └── types.ts      # Common type definitions
├── services/         # Use case implementations
│   └── release-checker.ts  # Main business logic
├── cli/              # CLI entry point
│   └── index.ts
└── utils/            # Helper functions
    ├── date.ts       # Date/time utilities
    ├── result.ts     # Result type definition and operations
    └── logger.ts     # Logging

tests/
├── unit/             # Unit tests
│   ├── lib/
│   ├── services/
│   └── utils/
└── system/           # System tests
```

### Directory Responsibilities

#### lib/
- **Collection of pure functions**
- **No side effects**
- **Easy to test**
- Example:
  ```typescript
  // schedule.ts
  export const isWithinSchedule = (
    schedule: Schedule,
    currentTime: Date
  ): boolean => {
    // Pure judgment logic
  };
  
  export const findOverlaps = (
    schedules: Schedule[]
  ): Schedule[] => {
    // Pure function to detect overlaps
  };
  ```

#### services/
- **Handle side effects**
- **Combine functions from lib**
- **Include external API communication**
- Example:
  ```typescript
  // release-checker.ts
  export const checkRelease = async (config: Config): Promise<Result<void>> => {
    // 1. Fetch reservations from spreadsheet
    // 2. Check against current time
    // 3. Send Slack notification
    // 4. Wait for reactions
  };
  ```

#### cli/
- **Handle command line arguments**
- **Load configuration**
- **Call services**
- **Manage exit codes**

#### utils/
- **Common utilities**
- **Result type and its operations**
- **Logging**
- **Date/time operations**

### Using Result Type
```typescript
// utils/result.ts
export type Result<T, E = Error> = 
  | { ok: true; value: T }
  | { ok: false; error: E };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

// Usage example
const fetchSchedules = async (): Promise<Result<Schedule[]>> => {
  try {
    const data = await sheets.fetch();
    return ok(data);
  } catch (error) {
    return err(new Error('Failed to fetch schedules'));
  }
};
```

### Dependency Management
- **Injection via configuration object**
- **Pass mocks during testing**
- Example:
  ```typescript
  interface Config {
    slackToken: string;
    spreadsheetId: string;
    channelId: string;
    // ...
  }
  
  interface Services {
    slack: SlackClient;
    sheets: SheetsClient;
  }
  
  // Inject mocks during testing
  const mockServices: Services = {
    slack: mockSlackClient,
    sheets: mockSheetsClient,
  };
  ```

## Others
(Other information here)