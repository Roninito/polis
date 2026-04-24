# Email Notifications Testing Guide

## Quick Start

### 1. Start POLIS API with Console Mode

```bash
cd apps/api

# Make sure EMAIL_API_KEY is NOT set (to use console fallback)
unset EMAIL_API_KEY

# Start the API
bun run dev
```

You should see:
```
[polis] Email provider: console
```

### 2. Test Member Invitation Email

```bash
# Get an auth token first (if needed)
# Then add a member to trigger the welcome email:

curl -X POST http://localhost:3143/api/v1/orgs/org_123/members \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "role": "voting"
  }'
```

**Expected Output in Logs:**
```
[Email] (no API key, console fallback) To: test@example.com, Subject: Welcome to POLIS
<html>...</html>
```

### 3. Test Proposal Notification Email

```bash
curl -X POST http://localhost:3143/api/v1/orgs/org_123/proposals \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "budget",
    "title": "Test Proposal",
    "body": "This is a test proposal.",
    "votingEnds": "2024-12-31T23:59:59Z"
  }'
```

**Expected Output in Logs:**
```
[Email] (no API key, console fallback) To: member@example.com, Subject: New Proposal: Test Proposal
<html>...</html>
```

---

## Production Testing with Resend

### Setup

1. **Get Resend API Key**
   - Sign up at https://resend.com
   - Get API key from dashboard

2. **Set Environment Variable**
   ```bash
   export EMAIL_API_KEY="re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
   ```

3. **Update Config** (optional, default is console)
   Edit `polis.config.json`:
   ```json
   {
     "email": {
       "provider": "resend",
       "from": "noreply@yourdomain.com",
       "apiKeyRef": "env:EMAIL_API_KEY"
     }
   }
   ```

4. **Restart API**
   ```bash
   bun run dev
   ```

   You should see:
   ```
   [polis] Email provider: resend
   ```

### Test with Resend

**Test Email (won't actually send):**
```bash
curl -X POST http://localhost:3143/api/v1/orgs/org_123/members \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test",
    "email": "delivered@resend.dev",
    "role": "voting"
  }'
```

The email will be marked as "delivered" in Resend dashboard without actually sending.

**Real Email Test:**
```bash
curl -X POST http://localhost:3143/api/v1/orgs/org_123/members \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alice",
    "email": "alice@example.com",
    "role": "voting"
  }'
```

Check Resend dashboard for delivery status. Alice should receive the email if alice@example.com is valid.

---

## Debugging

### Enable Debug Logging

Add this to your code to see detailed email info:

```typescript
// In src/email/provider.ts, uncomment logging
console.log("[Email] Sending via resend to:", options.to);
console.log("[Email] Subject:", options.subject);
```

### Check Configuration

```bash
# Print current email config (safe, no secrets)
cat polis.config.json | jq '.email'

# Check if EMAIL_API_KEY is set
echo $EMAIL_API_KEY  # Should show the key or be empty
```

### Verify Template Rendering

Test templates directly:

```typescript
import { renderMemberInviteTemplate } from "./email/templates";

const html = renderMemberInviteTemplate({
  memberName: "John",
  memberEmail: "john@example.com",
  orgName: "Test Org",
  memberRole: "voting",
  loginLink: "https://polis.local/login",
});

console.log(html);  // Check rendered HTML
```

### Monitor Logs

For development, watch logs:
```bash
bun run dev | grep "\[Email\]"
```

For production:
```bash
docker logs polis-api | grep "\[Email\]"
```

---

## Troubleshooting

### Issue: Emails not being sent

**Check 1: Is email service initialized?**
```bash
# Look for this in startup logs:
# [polis] Email provider: console
# [polis] Email provider: resend
```

If you see "Email service not configured", the config is missing.

**Check 2: Is EMAIL_API_KEY set?**
```bash
echo $EMAIL_API_KEY
# Should output the API key or be empty (for console mode)
```

**Check 3: Are members/proposals being created?**
```bash
# Check the response from the API call
curl -v ... # Add verbose flag to see request/response
```

### Issue: Email says "no API key, console fallback"

This is **expected** if:
- EMAIL_API_KEY is not set (intentional for development)
- provider is "console" (for development/testing)

To send real emails:
1. Set EMAIL_API_KEY environment variable
2. Change provider to "resend" in config
3. Restart the API

### Issue: "Email service not initialized"

**Cause:** Email initialization failed or happened before config was loaded.

**Fix:**
1. Make sure setup wizard completed (config exists)
2. Check config file has valid email section
3. Check logs for config loading errors

---

## Email Content Verification

### Check Member Invite Email

The rendered HTML should include:
- ✅ Organization name
- ✅ Member name  
- ✅ Member role
- ✅ Login link button
- ✅ Professional styling (gradients, spacing)

### Check Proposal Notification Email

The rendered HTML should include:
- ✅ Organization name
- ✅ Proposal title
- ✅ Proposal type
- ✅ Proposal excerpt (first 200 chars)
- ✅ Voting deadline
- ✅ Vote button/link
- ✅ Proposed by name

### Check Voting Reminder Email

The rendered HTML should include:
- ✅ Urgent warning banner
- ✅ Hours remaining count
- ✅ Proposal details
- ✅ Vote button/link
- ✅ Red/alert styling

---

## Performance Testing

### Test Email Sending Performance

```bash
# Add 10 members (triggers 10 emails)
for i in {1..10}; do
  curl -X POST http://localhost:3143/api/v1/orgs/org_123/members \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"User$i\",\"email\":\"user$i@test.com\",\"role\":\"voting\"}" &
done
wait

# All requests should complete quickly (<100ms)
# Emails send in background asynchronously
```

### Async Email Sending

Emails are sent **after** the API request completes:
- Request returns immediately ✅
- Emails sent in background 🔄
- No blocking of API response ✅

---

## Integration with CI/CD

### GitHub Actions Example

```yaml
- name: Test Email Notifications
  env:
    EMAIL_API_KEY: ${{ secrets.RESEND_API_KEY }}
  run: |
    bun run dev &
    sleep 3
    
    # Test member invite
    curl -X POST http://localhost:3143/api/v1/orgs/test/members \
      -H "Authorization: Bearer test" \
      -H "Content-Type: application/json" \
      -d '{"name":"Test","email":"test@test.com","role":"voting"}'
    
    # Check logs
    sleep 1
    echo "Email sent successfully"
```

---

## Next Steps

After testing emails locally:

1. **Set up production email provider**
   - Choose Resend, SendGrid, or Mailgun
   - Configure API key in secrets

2. **Deploy to production**
   - Update polis.config.json on server
   - Set EMAIL_API_KEY environment variable
   - Restart API

3. **Monitor email delivery**
   - Check provider dashboard for stats
   - Monitor API logs for [Email] errors
   - Set up alerts for delivery failures

4. **Implement voting reminders** (future)
   - Cron job to check voting deadlines
   - Send reminder 24 hours before voting ends
   - See `renderVotingReminderTemplate()` for template

---

**Status:** Ready for testing! 🚀
