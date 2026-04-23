# POLIS User Guide

**Version:** 1.0  
**Last Updated:** 2025-04-23  
**Audience:** End Users, Organization Administrators

## Table of Contents

1. [Getting Started](#getting-started)
2. [Account & Authentication](#account--authentication)
3. [Creating an Organization](#creating-an-organization)
4. [Managing Members](#managing-members)
5. [Creating & Managing Proposals](#creating--managing-proposals)
6. [Voting on Proposals](#voting-on-proposals)
7. [Viewing Results & Analytics](#viewing-results--analytics)
8. [Treasury & Financial Tracking](#treasury--financial-tracking)
9. [Organization Settings](#organization-settings)
10. [FAQ](#faq)

---

## Getting Started

### What is POLIS?

POLIS is a **democratic governance platform** that helps organizations make decisions together. Whether you're managing a family trust, a town government, a church, or a business, POLIS lets you:

- 📝 **Create proposals** for decisions
- 🗳️ **Vote democratically** with transparency
- 🤖 **Get AI-powered analysis** of proposals
- 📊 **Track results** in real-time
- 💰 **Manage budgets** and financial impacts
- 📋 **Maintain audit trails** for compliance

### Accessing POLIS

**Option 1: SaaS (Multi-tenant)**
- Visit: `https://polis.app` (or your organization's domain)
- No installation required; uses cloud-hosted version

**Option 2: Self-Hosted**
- Your organization provides: `https://polis.yourcompany.com`
- IT department manages the deployment

---

## Account & Authentication

### Registering Your Account

**Step 1: Go to the registration page**

Click "Sign Up" on the login page.

**Step 2: Enter your information**

- **Email:** Your work or personal email
- **Password:** At least 12 characters, mix of uppercase, lowercase, numbers, symbols
- **Full Name:** Your name (used in member lists)

**Step 3: Verify email (if required)**

Check your email inbox for a confirmation link. Click it to activate your account.

✅ Your account is now active!

### Logging In

1. Go to `https://polis.app/login`
2. Enter your email and password
3. Click "Sign In"

Your session will remain active for **7 days**. You can logout anytime from the account menu.

### Resetting Your Password

**Lost your password?**

1. Click "Forgot Password?" on the login page
2. Enter your email
3. Check your email for a reset link
4. Click the link and set a new password
5. Log in with your new password

> **Security Tip:** Use a strong, unique password. POLIS never stores your password in plaintext — we use industry-standard bcrypt hashing.

### Two-Factor Authentication (Optional)

Coming soon! Enable optional 2FA in your account settings to add an extra security layer.

---

## Creating an Organization

### Step 1: Start an Organization

After logging in, you'll see the home page. Click **"Create Organization"** in the top right.

### Step 2: Fill in Organization Details

| Field | Description | Example |
|-------|-------------|---------|
| **Organization Name** | Public name of your group | "Smith Family Trust" |
| **Description** | Brief description (optional) | "Family financial decisions" |
| **Type** | Select your organization type | Family Trust, Government, Church, Business, Other |
| **Public/Private** | Is your org visible to non-members? | Select based on needs |

### Step 3: Set Up Governance Rules

**Quorum:** What percentage of members must vote for a decision to be valid?
- Recommended: 50% (majority)
- Example: If you have 10 members, at least 5 must vote

**Voting Period:** How long is voting open?
- Default: 7 days
- Can be customized per proposal

**Approval Threshold:** What percentage vote is needed to pass?
- Simple Majority: >50%
- Super Majority: >66%
- Consensus: 100% agreement

### Step 4: Add Members

See [Managing Members](#managing-members) section below.

### Step 5: Review & Create

Review your settings and click **"Create Organization"**. You're now the organization administrator!

---

## Managing Members

### Viewing Members

1. Go to your organization dashboard
2. Click **"Members"** in the left sidebar
3. See all members, their roles, and join date

### Adding Members

**Step 1: Click "Invite Members"**

On the Members page, click the **"+ Invite"** button.

**Step 2: Enter member emails**

```
Email addresses (one per line):
alice@example.com
bob@example.com
charlie@example.com
```

**Step 3: Set member role**

- **Voter:** Can vote on proposals (default)
- **Manager:** Can vote AND create proposals
- **Admin:** Full organization access (careful with this!)

**Step 4: Send invitations**

Click **"Send Invites"**. Members receive an email with a link to join your organization.

> **Note:** Members must create a POLIS account before accepting the invitation (unless your organization has SSO configured).

### Managing Member Roles

As an admin:

1. Click the member's name on the Members page
2. Select their new role: Voter → Manager → Admin
3. Click "Save"

### Removing Members

1. Click the member's name
2. Click **"Remove from Organization"**
3. Confirm deletion

> **Note:** Removing a member does NOT delete their voting history or comments. They remain in the audit trail.

### Member Permissions

| Action | Voter | Manager | Admin |
|--------|-------|---------|-------|
| Vote | ✅ | ✅ | ✅ |
| View proposals | ✅ | ✅ | ✅ |
| Create proposals | ❌ | ✅ | ✅ |
| Modify proposals | ❌ | Own only | ✅ |
| Manage members | ❌ | ❌ | ✅ |
| Edit org settings | ❌ | ❌ | ✅ |
| Delete organization | ❌ | ❌ | ✅ |

---

## Creating & Managing Proposals

### Creating a Proposal

**Step 1: Click "New Proposal"**

From your organization dashboard, click **"+ New Proposal"** (if you're a Manager or Admin).

**Step 2: Fill in proposal details**

| Field | Description | Example |
|-------|-------------|---------|
| **Title** | Concise summary | "Approve Annual Budget" |
| **Description** | Detailed explanation | "Proposed budget for fiscal year 2025..." |
| **Type** | Vote or Poll | Vote (binding decision) or Poll (feedback) |
| **Category** | Categorize the proposal | Budget, Governance, Personnel, Other |

**Step 3: Set voting parameters**

- **Voting Starts:** Immediately or schedule for later
- **Voting Ends:** Default is 7 days; customize as needed
- **Quorum Requirement:** Default from org settings; override if needed
- **Approval Threshold:** Default from org settings; override if needed

**Step 4: Add voting options** (for polls)

If you selected "Poll" type, add custom options:

```
- [ ] Option A
- [ ] Option B
- [ ] Option C
```

**Step 5: Review & publish**

Click **"Create Proposal"**. It's now live and members can vote!

### Editing a Proposal

**Before voting starts:** You can edit any field

1. Click the proposal
2. Click **"Edit"**
3. Make changes
4. Click **"Save"**

**After voting starts:** You can only edit:
- Description (to clarify, not change meaning)
- Voting end time (extend if needed)

### Withdrawing a Proposal

1. Click the proposal
2. Click **"Withdraw"**
3. Confirm (cannot be undone)

Members who already voted will see it was withdrawn but their votes are preserved in the audit trail.

---

## Voting on Proposals

### Finding Proposals to Vote On

1. Go to organization dashboard
2. Click **"Proposals"** in the left sidebar
3. See all open proposals

**Filtering:**
- **Status:** Open, Closed, Executed
- **Category:** Budget, Governance, etc.
- **My Votes:** Only proposals you've voted on

### Voting on a Proposal

**Step 1: Click the proposal**

From the proposals list, click to view full details.

**Step 2: Review the information**

- **Title & Description:** Understand what you're voting on
- **Timeline:** When does voting close?
- **Current Results:** See how others are voting (real-time updates)
- **Voting Requirements:** What threshold is needed to pass?

**Step 3: Cast your vote**

For **Vote** type:
```
How do you vote?
[ ] Yes (support)
[ ] No (oppose)
[ ] Abstain (no position)
```

For **Poll** type:
```
Select your preference:
( ) Option A
( ) Option B
( ) Option C
```

**Step 4: Submit**

Click **"Submit Vote"**. Your vote is recorded immediately.

> **Note:** You can change your vote at any time before voting closes. Just click the proposal again and re-vote.

### Vote Transparency

POLIS shows:
- ✅ Total votes: Yes, No, Abstain
- ✅ Vote percentage: 67% approval, 33% oppose
- ✅ Voting timeline: X days remaining
- ✅ Member participation: X of Y members voted

Individual votes are **private by default** (unless your organization configured public voting).

---

## Viewing Results & Analytics

### Proposal Results

**When voting closes,** results are automatically calculated:

1. Click a closed proposal
2. View results section:

```
VOTING RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Yes:     120 votes (67%)  ████████████████░░ 67%
No:       50 votes (28%)  ██████░░░░░░░░░░░░ 28%
Abstain:  10 votes (5%)   █░░░░░░░░░░░░░░░░░░ 5%

Quorum: 150 / 180 members voted (83%) ✅ PASSED
Threshold: 67% ≥ 50% required ✅ PASSED

Status: ✅ APPROVED
```

### AI Analysis (SAR Engine)

After voting closes, POLIS may generate an **AI-powered analysis:**

```
SAR ENGINE ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generated: 2025-04-23 10:30 AM

Recommendation: APPROVE with caution

Key Insights:
• Budget increase is 12% above historical average
• 3 major expense categories show growth
• Revenue projections assume 8% growth
• Risks: Dependent on new customer acquisition

Suggested Next Steps:
1. Request detailed expense breakdown
2. Review revenue projections with finance team
3. Set quarterly checkpoints
```

This analysis is **advisory only** — your organization makes the final decision.

### Organization Dashboard

Your organization's home page shows:

- **Quick Stats:**
  - Total members: 47
  - Active proposals: 3
  - Approved proposals this month: 8
  - Pending execution: 2

- **Recent Activity:**
  - Timeline of proposals, votes, and decisions
  - Who voted when
  - Member join dates

- **Alerts:**
  - Proposals closing soon
  - Waiting your vote
  - Proposals ready to execute

---

## Treasury & Financial Tracking

### Viewing Treasury

1. Go to organization dashboard
2. Click **"Treasury"** in the left sidebar

**Treasury Dashboard shows:**

```
BALANCE: $50,000.00
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BUDGETS (by category):
  Operations:    $20,000 (40% spent)
  Marketing:     $15,000 (60% spent)
  R&D:           $10,000 (20% spent)
  Reserves:      $5,000  (0% spent)

RECENT TRANSACTIONS:
  2025-04-20  Equipment Purchase    -$2,500
  2025-04-18  Salary Payroll         -$8,000
  2025-04-15  Customer Payment      +$12,000
  2025-04-10  Quarterly Bonus       -$3,500
```

### Creating a Budget

As an admin:

1. Click **"+ New Budget"**
2. Enter:
   - **Category:** Operations, Marketing, etc.
   - **Amount:** Total budget for category
   - **Period:** Monthly, Quarterly, Annual
3. Click **"Create"**

### Associating Financial Impact with Proposals

When creating a proposal, you can specify financial impact:

```
FINANCIAL IMPACT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Affected Budget:    Operations
Impact Amount:      -$5,000 (expense)
Justification:      New server hardware for production
```

This helps members understand the **full cost** of decisions.

### Viewing Budget vs. Actual

Click a budget category to see:

```
BUDGET DETAILS: Operations
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Budget:             $20,000
Spent to Date:      $12,000 (60%)
Remaining:          $8,000
Projected End:      $19,500

Recent Expenses:
  2025-04-20  Equipment    -$2,500
  2025-04-18  Payroll      -$8,000
  2025-04-10  Supplies     -$1,500
```

---

## Organization Settings

### Accessing Settings

1. Go to organization dashboard
2. Click **"Settings"** (gear icon in top right)

### Basic Settings

**Organization Name**
- Change your organization's display name
- Does not change your org URL

**Description**
- Update your public description
- Shows on organization profile

**Organization Type**
- Classify your org (Family, Government, Business, etc.)
- Used for analytics and recommendations

**Public/Private**
- **Public:** Non-members can view basic info (name, description)
- **Private:** Only members can see organization

### Governance Rules

**Voting Period**
- Default: 7 days
- Can override per proposal
- Recommended: 5-14 days (depends on org size)

**Quorum Requirement**
- Default: 50% of members must vote
- Set to your org's preference (e.g., 33%, 50%, 66%)

**Approval Threshold**
- Default: Simple Majority (>50%)
- Options:
  - Simple Majority: >50%
  - Super Majority: >66%
  - Consensus: 100%

### Member Defaults

**Default Role for New Members**
- Voter (recommended for transparency)
- Manager (for trusted members only)

**Allow Self-Registration**
- Enable: Anyone can join with link (open organizations)
- Disable: Admin must invite (closed organizations)

### Email Notifications

Choose what you want to be notified about:

- ✅ New proposal created
- ✅ Voting closing soon (24 hours)
- ✅ Proposal I voted on closed
- ✅ Member joined organization
- ✅ Admin message
- ❌ Weekly digest

### Data Export

As an admin, you can export all organization data:

1. Click **"Export Data"** (bottom of settings)
2. Choose format: JSON or CSV
3. Download file

This includes:
- All members and roles
- All proposals and votes
- All comments
- Financial records
- Complete audit trail

> **Note:** This data is **yours to keep forever** — no lock-in!

---

## FAQ

### General Questions

**Q: Is my data safe?**

A: Yes. POLIS uses:
- Industry-standard encryption (TLS 1.3)
- Bcrypt password hashing (not reversible)
- Automatic daily backups
- Disaster recovery procedures
- ISO 27001 compliance (SaaS version)

**Q: Can I export my data?**

A: Yes, anytime. As an admin, go to Settings → "Export Data" and download a complete JSON/CSV export of your organization.

**Q: What's the maximum organization size?**

A: No hard limit. POLIS supports organizations from 2 to 10,000+ members. Performance is optimized for organizations up to 10,000 members.

**Q: Can I delete my organization?**

A: Yes. Go to Settings → "Delete Organization" (admins only). This deletes all data permanently — cannot be undone.

**Q: How much does it cost?**

A: Pricing varies by deployment:
- **SaaS:** $99-999/month depending on member count
- **Self-Hosted:** Annual license or open-source (AGPLv3)
- **Enterprise:** Custom pricing for white-label / custom features

### Voting Questions

**Q: Can I change my vote after voting?**

A: Yes. Click the proposal anytime before voting closes and re-vote.

**Q: What's the difference between a "Vote" and a "Poll"?**

A: 
- **Vote:** Binding decision (Yes/No/Abstain) with approval thresholds
- **Poll:** Non-binding feedback (custom options, no threshold)

**Q: Can voting be anonymous?**

A: By default, no. Members see who voted for what (transparency). Your organization can change this in Settings → "Anonymous Voting" (if enabled).

**Q: What happens if quorum is not reached?**

A: The proposal fails automatically and shows "Insufficient Quorum" in results. No one is obligated to execute it.

**Q: How are ties broken?**

A: Ties (exactly 50%) depend on your approval threshold:
- **Simple Majority:** Tie = proposal fails
- **Super Majority:** Tie = proposal fails
- **Consensus:** Tie = proposal fails

Proposal creator can re-open voting to clarify issues.

### Technical Questions

**Q: Does POLIS work on mobile?**

A: Yes. POLIS is responsive and works on:
- iPhone / iPad
- Android phones / tablets
- Desktop browsers

**Q: What browsers are supported?**

A: Modern browsers (last 2 versions):
- Chrome / Chromium
- Firefox
- Safari
- Edge

**Q: Do you have a mobile app?**

A: Currently, no native app. Mobile web (responsive) works great.

**Q: Is there an API for integration?**

A: Yes (for self-hosted). See [DEPLOYMENT.md](./DEPLOYMENT.md) for API documentation.

### Compliance Questions

**Q: Is POLIS compliant with GDPR?**

A: 
- **SaaS:** Yes, Data Processing Agreement available
- **Self-Hosted:** Compliance is your responsibility

See Privacy Policy and Data Processing Agreement on our website.

**Q: Can we use POLIS for legal decisions?**

A: POLIS is a **tool to record decisions**, but:
- Not a substitute for legal review
- Not for voting on binding legal matters (consult lawyer)
- Good for internal governance and transparency

**Q: Do we need Board approval to use POLIS?**

A: Depends on your organization's bylaws. Typically:
- Family Trusts: No approval needed
- Non-profits / Corporations: Check bylaws
- Government: May require formal adoption

---

## Support & Resources

**Need help?**
- Check the FAQ above
- Email: support@polis.app
- Community forum: https://community.polis.app
- Documentation: https://docs.polis.app

**Reporting bugs?**
- Email: security@polis.app (for security issues)
- GitHub Issues: https://github.com/yourorg/polis/issues

**Feature requests?**
- Post in community forum
- Vote on planned features: https://roadmap.polis.app

---

**Last updated:** 2025-04-23  
**Version:** 1.0
