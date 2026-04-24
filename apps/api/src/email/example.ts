/**
 * Email usage examples — demonstrates how to send emails for governance events.
 * This file is for reference and testing purposes.
 */

import { sendEmail } from "./provider";
import {
  renderMemberInviteTemplate,
  renderProposalCreatedTemplate,
  renderVotingReminderTemplate,
} from "./templates";

/**
 * Example: Send a member invitation email
 */
export async function exampleSendMemberInvite() {
  const html = renderMemberInviteTemplate({
    memberName: "Alice Smith",
    memberEmail: "alice@example.com",
    orgName: "Community DAO",
    memberRole: "voting",
    loginLink: "https://polis.example.com/login",
  });

  await sendEmail({
    to: "alice@example.com",
    subject: "Welcome to Community DAO on POLIS",
    html,
  });
}

/**
 * Example: Send a proposal notification email
 */
export async function exampleSendProposalNotification() {
  const html = renderProposalCreatedTemplate({
    memberName: "Bob Johnson",
    orgName: "Community DAO",
    proposalTitle: "Increase treasury reserves by 10%",
    proposalType: "budget",
    proposalBody: "This proposal suggests increasing our treasury reserves to improve financial stability.",
    proposedBy: "Alice Smith",
    votingDeadline: "December 15, 2024, 05:00 PM",
    voteLink: "https://polis.example.com/org/org123/proposals/prop456",
  });

  await sendEmail({
    to: "bob@example.com",
    subject: "New Proposal: Increase treasury reserves by 10%",
    html,
  });
}

/**
 * Example: Send a voting deadline reminder email
 */
export async function exampleSendVotingReminder() {
  const html = renderVotingReminderTemplate({
    memberName: "Charlie Davis",
    orgName: "Community DAO",
    proposalTitle: "Increase treasury reserves by 10%",
    proposalType: "budget",
    proposalBody: "This proposal suggests increasing our treasury reserves...",
    votingDeadline: "December 15, 2024, 05:00 PM",
    hoursRemaining: 4,
    voteLink: "https://polis.example.com/org/org123/proposals/prop456",
  });

  await sendEmail({
    to: "charlie@example.com",
    subject: "⏰ Voting Reminder: Increase treasury reserves by 10%",
    html,
  });
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  console.log("Running email examples...");
  
  try {
    await exampleSendMemberInvite();
    console.log("✓ Member invite email sent");
  } catch (e) {
    console.error("✗ Failed to send member invite:", e);
  }

  try {
    await exampleSendProposalNotification();
    console.log("✓ Proposal notification email sent");
  } catch (e) {
    console.error("✗ Failed to send proposal notification:", e);
  }

  try {
    await exampleSendVotingReminder();
    console.log("✓ Voting reminder email sent");
  } catch (e) {
    console.error("✗ Failed to send voting reminder:", e);
  }
}
