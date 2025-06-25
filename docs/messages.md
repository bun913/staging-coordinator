# Slack Message Formats

This document describes the message formats used by the Staging Environment Coordinator for Slack notifications.

## 1. Release Request Message

This is the initial message sent when a release is requested for an environment with active schedules.

### Format:
```
🚀 *Release Request*

📦 *Product:* {productName}
🌍 *Environment:* {environmentName}
👤 *Requested by:* <@{requesterUserId}> (optional - only if requesterUserId is provided)

📅 *Active Schedules:*
• {productName} ({personInChargeName})
• ... (multiple schedules if there are overlapping reservations)

━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ React with :{approveReaction}: to *approve*
❌ React with :{rejectReaction}: to *reject*
⏰ Timeout: {waitMinutes} minutes
```

### Example:
```
🚀 *Release Request*

📦 *Product:* serviceA
🌍 *Environment:* staging
👤 *Requested by:* <@U1234ABCD>

📅 *Active Schedules:*
• serviceA (Tanaka Taro)
• serviceA (Suzuki Hanako)

━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ React with :ok: to *approve*
❌ React with :-1: to *reject*
⏰ Timeout: 20 minutes
```

### Mentions:
- The message mentions all person-in-charge IDs from active schedules using `<@{userId}>` format
- Multiple mentions are included in a single message if there are overlapping schedules

## 2. Error Notification Message

When an error occurs during the initial phase (spreadsheet fetch, etc.), this message is sent.

### Format:
```
⚠️ Error occurred while checking schedules: {errorMessage}
Proceeding with release for availability.
```

### Example:
```
⚠️ Error occurred while checking schedules: Failed to connect to Google Sheets API
Proceeding with release for availability.
```

## 3. Approval Result Messages (Thread)

These messages would be posted as thread replies to the original release request message.

### Approval Message (To be implemented):
```
✅ <@{approverUserId}> approved the release
```

### Rejection Message (To be implemented):
```
❌ <@{rejectorUserId}> rejected the release
```

### Example Thread:
```
Original: 🚀 Release Request for serviceA...
├─ ✅ <@U1234ABCD> approved the release
└─ (Release proceeds)
```

or

```
Original: 🚀 Release Request for serviceA...
├─ ❌ <@U5678EFGH> rejected the release
└─ (Release halted)
```

## 4. Final Status Messages (To be implemented)

These messages could be posted to indicate the final status of the release.

### Release Proceeded:
```
🚀 Release for {productName} ({environmentName}) has been initiated
✅ Approved by: <@{approverUserId}>
```

### Release Rejected:
```
🛑 Release for {productName} ({environmentName}) has been cancelled
❌ Rejected by: <@{rejectorUserId}>
```

### Release Timed Out:
```
⏱️ Release request for {productName} ({environmentName}) timed out
No response received within {waitMinutes} minutes
```

## Configuration

Message reactions are configurable via environment variables:
- `APPROVE_REACTION`: Default is `ok`
- `REJECT_REACTION`: Default is `-1`
- `WAIT_MINUTES`: Default is 20

## Notes

1. All user mentions use Slack's `<@userId>` format to create clickable mentions
2. Messages use Slack's mrkdwn formatting for bold text and structure
3. Emojis are used to make messages visually clear and scannable
4. Thread replies maintain context and history of the approval process
