# Email Notifications Implementation — POLIS P1 Feature

## Overview

This document summarizes the email notifications feature for the POLIS governance platform. Email notifications are sent when key governance events occur, keeping members informed and engaged.

## Implementation Summary

### ✅ Completed Tasks

1. **Email Provider Module** (`src/email/provider.ts`)
   - Supports multiple providers: Resend, SendGrid, Mailgun, console
   - Graceful error handling — fails don't break requests
   - Console fallback when API key is missing
   - Ready for production with Resend API integrated

2. **Email Templates** (`src/email/templates.ts`)
   - **Member Invite** — Onboarding email for new organization members
   - **Proposal Created** — Notification when proposals go live
   - **Voting Reminder** — Optional reminder before voting deadlines
   - Professional HTML/CSS with responsive design
   - Template variables support for customization

3. **Configuration** (`polis.config.json` + `src/config/types.ts`)
   - Email configuration schema added to config system
   - Support for multiple email providers
   - Environment variable references (e.g., `EMAIL_API_KEY`)
   - Easy provider switching without code changes

4. **Event Integration**

   **Member Invitations** (`src/api/members/routes.ts`)
   - `POST /orgs/:id/members` now sends welcome email
   - Triggered automatically when member is added
   - Includes role, org name, and login link

   **Proposal Notifications** (`src/api/proposals/routes.ts`)
   - `POST /orgs/:id/proposals` sends to all active members
   - Async email sending (doesn't block request)
   - Includes proposal details, type, voting deadline
   - Link to vote directly from email

5. **API Initialization** (`src/handler.ts`)
   - Email service initialized on API startup
   - Configuration read from `polis.config.json`
   - Re-initialized after setup wizard completes

### 📁 Files Created

```
apps/api/src/email/
├── provider.ts          # Email service (multi-provider support)
├── templates.ts         # Template renderers for all 3 events
├── example.ts           # Usage examples and testing
└── README.md           # Detailed documentation
```

### 📝 Files Modified

- `apps/api/src/config/types.ts` — Added EmailConfig interface
- `apps/api/src/handler.ts` — Added email service initialization
- `apps/api/src/api/members/routes.ts` — Wire up member invite emails
- `apps/api/src/api/proposals/routes.ts` — Wire up proposal notification emails
- `polis.config.json` — Added email configuration block

### 🔧 Dependencies Added

- `resend@6.12.2` — Modern transactional email service (recommended)

## Configuration

### Setup Email Service

Edit `polis.config.json`:

```json
{
  "email": {
    "provider": "console",
    "from": "noreply@polis.local",
    "apiKeyRef": "env:EMAIL_API_KEY"
  }
}
```

### Set Provider API Key

```bash
# For Resend (recommended)
export EMAIL_API_KEY="re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# For SendGrid
export EMAIL_API_KEY="SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# For Mailgun
export EMAIL_API_KEY="key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

### Console Mode (Development)

To test without actually sending emails:

```json
{
  "email": {
    "provider": "console",
    "from": "noreply@polis.local"
  }
}
```

Emails will be logged to stdout:
```
[Email] To: user@example.com, Subject: Welcome to POLIS
<html>...</html>
```

## Usage

### Automatic Event Emails

Emails are sent automatically when:

1. **Member Added** — Welcome email with login link
2. **Proposal Created** — Notification to all members with voting link
3. **Voting Reminder** — Optional (can be triggered by cron/webhook)

### Manual Email Sending

```typescript
import { sendEmail } from "./email/provider";
import { renderMemberInviteTemplate } from "./email/templates";

const html = renderMemberInviteTemplate({
  memberName: "John Doe",
  memberEmail: "john@example.com",
  orgName: "Acme DAO",
  memberRole: "voting",
  loginLink: "https://polis.example.com/login",
});

await sendEmail({
  to: "john@example.com",
  subject: "Welcome to Acme DAO",
  html,
});
```

## Testing

### With Resend

Resend provides free tier with excellent testing. Use any email to test:
- `delivered@resend.dev` — Test successful delivery
- Real emails work too

### Local Development

Option 1: Console mode (logs to stdout)
```json
{ "email": { "provider": "console", "from": "noreply@polis.local" } }
```

Option 2: MailHog (captures all emails)
```bash
mailhog  # Start local email server
# Access at http://localhost:1025
```

Option 3: No API key (falls back to console)
```bash
# Don't set EMAIL_API_KEY — emails will be logged
```

## Error Handling

- ✅ If API key is missing: falls back to console logging
- ✅ If provider is down: logs error, request succeeds
- ✅ If email address invalid: logs error, request succeeds
- ✅ Member/proposal operations never fail due to email errors

## Architecture

```
Event Occurs (member added, proposal created)
    ↓
Route Handler (addMember, createProposal)
    ↓
Get Template Data (org name, member email, etc.)
    ↓
Render HTML Email (renderTemplate)
    ↓
Send via Provider (sendEmail)
    │
    ├→ Resend API (production)
    ├→ SendGrid API (alternative)
    ├→ Mailgun API (alternative)
    └→ Console Log (fallback/development)
```

## Future Enhancements

- [ ] Voting deadline reminders (cron job)
- [ ] Results summary emails
- [ ] Comment/reply notifications
- [ ] User unsubscribe preferences
- [ ] Plain text email versions
- [ ] Multi-tenant email templates
- [ ] Batch sending optimization
- [ ] Email verification/validation
- [ ] Webhook delivery tracking
- [ ] Custom org branding in templates

## Supported Email Providers

| Provider | Status | Notes |
|----------|--------|-------|
| **Resend** | ✅ Full | Recommended, easiest setup, free tier |
| **SendGrid** | ⚠️ Stub | Requires @sendgrid/mail, setup needed |
| **Mailgun** | ⚠️ Stub | Requires mailgun.js, setup needed |
| **Console** | ✅ Full | Development/testing mode |

## Security Considerations

- ✅ API keys stored in environment variables (never in code)
- ✅ Email addresses only logged with permission
- ✅ Templates don't contain sensitive data
- ✅ Graceful failures prevent information leakage
- ⚠️ Future: Add unsubscribe/preference management
- ⚠️ Future: Add DKIM/SPF verification

## Performance

- Async email sending — doesn't block API requests
- Emails sent in background after request completes
- No database writes for email logs (can be added later)
- Batch sending support for large organizations (future)

## Example API Calls

### Add Member (triggers invite email)

```bash
curl -X POST http://localhost:3143/api/v1/orgs/org123/members \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alice Smith",
    "email": "alice@example.com",
    "role": "voting"
  }'

# Email automatically sent to alice@example.com
```

### Create Proposal (sends to all members)

```bash
curl -X POST http://localhost:3143/api/v1/orgs/org123/proposals \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "budget",
    "title": "Increase reserves by 10%",
    "body": "Detailed proposal content...",
    "votingEnds": "2024-12-15T17:00:00Z"
  }'

# Emails sent to all active members
```

## Troubleshooting

**Q: Emails not sending**
- A: Check if EMAIL_API_KEY is set: `echo $EMAIL_API_KEY`
- A: Check email provider is configured in polis.config.json
- A: Review server logs for error messages

**Q: Want to test without sending?**
- A: Use `provider: "console"` in config or don't set EMAIL_API_KEY

**Q: Which provider should I use?**
- A: Start with Resend (simplest), then move to SendGrid if you need more features

**Q: Can I customize email templates?**
- A: Yes, edit `src/email/templates.ts` and rebuild
- A: Support for database-stored templates coming in v2

## Monitoring

Monitor email performance in production:

```bash
# Check API logs for [Email] messages
docker logs polis-api | grep "\[Email\]"

# With Resend dashboard:
# https://resend.com/dashboard — see delivery status

# With SendGrid/Mailgun:
# Use their respective dashboards for analytics
```

---

**Status:** ✅ Implementation Complete — Ready for Testing

**Next Steps:**
1. Set EMAIL_API_KEY environment variable
2. Test with `provider: "console"` first
3. Switch to Resend for production
4. Monitor email logs for errors
5. Implement voting reminder cron job (optional)
