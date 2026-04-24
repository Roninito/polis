# Email Notifications

The POLIS platform supports transactional email notifications for key governance events using configurable email providers.

## Features

- **Member Invitations** — Welcome email when a member is added to an organization
- **Proposal Created** — Notification to all members when a new proposal is submitted
- **Voting Reminders** — Optional reminders when voting deadlines are approaching (for future implementation)

## Configuration

### Setup

Add email configuration to `polis.config.json`:

```json
{
  "email": {
    "provider": "resend",
    "from": "noreply@yourdomain.com",
    "apiKeyRef": "env:EMAIL_API_KEY"
  }
}
```

### Supported Providers

- **`resend`** (Recommended) — Transactional email with free tier, great API
- **`sendgrid`** — Robust email service with generous free tier
- **`mailgun`** — Developer-friendly with detailed analytics
- **`console`** — Logs to console (for development/testing)

### Environment Variables

Set the API key as an environment variable referenced in config:

```bash
# For Resend
export EMAIL_API_KEY="re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# For SendGrid
export EMAIL_API_KEY="SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# For Mailgun
export EMAIL_API_KEY="key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

If no API key is set, emails are logged to console instead of being sent.

## Usage

### Sending Emails

Manually send emails using the `sendEmail` function:

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

### Event Hooks

Emails are automatically sent on these events:

#### Member Added (`POST /orgs/:id/members`)

When a member is invited to an organization, a welcome email is sent with:
- Organization name
- Member role
- Login link
- Organization branding

**Template:** `renderMemberInviteTemplate()`

#### Proposal Created (`POST /orgs/:id/proposals`)

When a new proposal is created, all active members receive a notification with:
- Proposal title and type
- Proposal summary
- Voting deadline
- Link to vote
- Call to action

**Template:** `renderProposalCreatedTemplate()`

## Development

### Console Mode

For development, set `email.provider` to `"console"` in config. Emails will be logged to stdout:

```
[Email] To: user@example.com, Subject: Welcome to POLIS
<html>...</html>
```

### Testing with Resend

Resend provides a built-in testing mode. Use any email like `delivered@resend.dev` to test without sending.

### Testing with MailHog

For local development, use MailHog to capture emails:

```bash
# Start MailHog (if installed)
mailhog

# Configure POLIS to use SMTP (future enhancement)
# Access UI at http://localhost:1025
```

## Email Templates

Templates are located in `src/email/templates.ts` and include:

1. **Member Invite** — Onboarding email for new members
2. **Proposal Created** — Notification when a proposal goes live
3. **Voting Reminder** — Reminder before voting deadline (optional)

All templates include:
- Professional HTML styling with gradients
- Responsive design for mobile/desktop
- Clear call-to-action buttons
- Organization branding hooks
- Plain text alternatives (future enhancement)

### Customizing Templates

Edit the template functions in `src/email/templates.ts`:

```typescript
export function renderMemberInviteTemplate(data: MemberInviteData): string {
  // Template HTML with {placeholder} variables
  // Returned HTML is processed by renderTemplate() function
}
```

Template variables are replaced using simple string substitution:
- `{orgName}` → organization name
- `{memberName}` → member name
- `{proposalTitle}` → proposal title
- etc.

## Error Handling

Email failures are graceful:

- If the API key is missing, emails are logged to console instead
- If the email provider is down, the request completes successfully but logs an error
- Member/proposal operations succeed even if email sending fails

## Future Enhancements

- [ ] Voting deadline reminders (cron job)
- [ ] Voting results summary emails
- [ ] Comment/reply notifications
- [ ] Unsubscribe links and preferences
- [ ] Plain text email versions
- [ ] Email templates in database (multi-tenant)
- [ ] Batch sending for large organizations
- [ ] Email verification/validation
- [ ] Webhook delivery status tracking
