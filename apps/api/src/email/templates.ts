/**
 * Email template renderer — loads and renders email templates with variable substitution.
 */

interface MemberInviteData {
  memberName: string;
  memberEmail: string;
  orgName: string;
  memberRole: string;
  loginLink: string;
  [key: string]: string;
}

interface ProposalCreatedData {
  memberName: string;
  orgName: string;
  proposalTitle: string;
  proposalType: string;
  proposalBody: string;
  proposedBy: string;
  votingDeadline: string;
  voteLink: string;
  [key: string]: string;
}

interface VotingReminderData {
  memberName: string;
  orgName: string;
  proposalTitle: string;
  proposalType: string;
  proposalBody: string;
  votingDeadline: string;
  hoursRemaining: number;
  voteLink: string;
  [key: string]: string | number;
}

function renderTemplate(template: string, data: Record<string, string | number>): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    const placeholder = new RegExp(`\\{${key}\\}`, "g");
    result = result.replace(placeholder, String(value));
  }
  return result;
}

export function renderMemberInviteTemplate(data: MemberInviteData): string {
  const template = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to {orgName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { background: #f9f9f9; padding: 40px 20px; border-radius: 0 0 8px 8px; }
    .cta-button { display: inline-block; background: #667eea; color: white; padding: 12px 28px; text-decoration: none; border-radius: 4px; margin: 20px 0; font-weight: 500; }
    .cta-button:hover { background: #5568d3; }
    .footer { text-align: center; padding: 20px; color: #999; font-size: 12px; }
    .role-badge { display: inline-block; background: #e0e7ff; color: #667eea; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; margin: 10px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to {orgName}</h1>
      <p>You've been invited to join our governance platform</p>
    </div>
    <div class="content">
      <p>Hi {memberName},</p>
      <p>You have been invited to join <strong>{orgName}</strong> on the POLIS governance platform.</p>
      <div class="role-badge">Role: {memberRole}</div>
      <p>As a member, you'll be able to:</p>
      <ul>
        <li>Participate in governance decisions</li>
        <li>Review and vote on proposals</li>
        <li>Engage with your community</li>
      </ul>
      <p>To get started, please log in to your account:</p>
      <a href="{loginLink}" class="cta-button">Log In to POLIS</a>
      <p><small>If you did not expect this invitation or have questions, please contact your organization administrator.</small></p>
    </div>
    <div class="footer">
      <p>This is an automated message from POLIS. Please do not reply to this email.</p>
      <p>&copy; 2024 POLIS. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

  return renderTemplate(template, data as unknown as Record<string, string | number>);
}

export function renderProposalCreatedTemplate(data: ProposalCreatedData): string {
  const template = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Proposal: {proposalTitle}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9f9f9; padding: 30px 20px; }
    .proposal-box { background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; }
    .proposal-box h3 { margin-top: 0; color: #667eea; }
    .proposal-box p { margin: 10px 0; }
    .deadline { background: #fff3cd; padding: 15px; border-radius: 4px; margin: 20px 0; border-left: 4px solid #ffc107; }
    .deadline strong { color: #856404; }
    .cta-button { display: inline-block; background: #667eea; color: white; padding: 12px 28px; text-decoration: none; border-radius: 4px; margin: 20px 0; font-weight: 500; }
    .cta-button:hover { background: #5568d3; }
    .footer { text-align: center; padding: 20px; color: #999; font-size: 12px; border-top: 1px solid #ddd; background: white; border-radius: 0 0 8px 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>New Proposal for {orgName}</h1>
      <p>A new proposal has been submitted for your review and vote</p>
    </div>
    <div class="content">
      <p>Hi {memberName},</p>
      <p>A new proposal has been created in <strong>{orgName}</strong> and is open for voting:</p>
      
      <div class="proposal-box">
        <h3>{proposalTitle}</h3>
        <p><strong>Type:</strong> {proposalType}</p>
        <p><strong>Proposed by:</strong> {proposedBy}</p>
        <p>{proposalBody}</p>
      </div>

      <div class="deadline">
        <strong>⏰ Voting Deadline:</strong> {votingDeadline}
      </div>

      <p>Please review the proposal and cast your vote:</p>
      <a href="{voteLink}" class="cta-button">Vote Now</a>

      <p><small>Your vote is important! Make sure to participate before the voting period closes.</small></p>
    </div>
    <div class="footer">
      <p>This is an automated message from POLIS. Please do not reply to this email.</p>
      <p>&copy; 2024 POLIS. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

  return renderTemplate(template, data as unknown as Record<string, string | number>);
}

export function renderVotingReminderTemplate(data: VotingReminderData): string {
  const template = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Voting Reminder: {proposalTitle}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px 20px; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9f9f9; padding: 30px 20px; }
    .alert-box { background: #fff5f5; padding: 20px; border-radius: 4px; border-left: 4px solid #f5576c; margin: 20px 0; }
    .alert-box strong { color: #f5576c; }
    .proposal-box { background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; }
    .proposal-box h3 { margin-top: 0; color: #667eea; }
    .cta-button { display: inline-block; background: #f5576c; color: white; padding: 12px 28px; text-decoration: none; border-radius: 4px; margin: 20px 0; font-weight: 500; }
    .cta-button:hover { background: #e0455a; }
    .footer { text-align: center; padding: 20px; color: #999; font-size: 12px; border-top: 1px solid #ddd; background: white; border-radius: 0 0 8px 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⏰ Voting Reminder</h1>
      <p>Time is running out to vote</p>
    </div>
    <div class="content">
      <p>Hi {memberName},</p>

      <div class="alert-box">
        <strong>⚠️ Voting ends in {hoursRemaining} hours!</strong>
        <p>Make sure to cast your vote before the voting period closes.</p>
      </div>

      <p>You still need to vote on this proposal:</p>

      <div class="proposal-box">
        <h3>{proposalTitle}</h3>
        <p><strong>Type:</strong> {proposalType}</p>
        <p><strong>Voting ends:</strong> {votingDeadline}</p>
        <p>{proposalBody}</p>
      </div>

      <p>Vote now to make your voice heard:</p>
      <a href="{voteLink}" class="cta-button">Cast Your Vote</a>

      <p><small>Once the voting period closes, you will no longer be able to vote on this proposal.</small></p>
    </div>
    <div class="footer">
      <p>This is an automated message from POLIS. Please do not reply to this email.</p>
      <p>&copy; 2024 POLIS. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

  return renderTemplate(template, data as unknown as Record<string, string | number>);
}
