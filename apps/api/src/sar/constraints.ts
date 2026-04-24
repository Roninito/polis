/**
 * SAR Constitutional Constraints — hardcoded guards.
 *
 * These 6 constraints CANNOT be overridden by any tenant configuration,
 * AI prompt, or platform operator action. They are enforced architecturally.
 */

/**
 * CONSTRAINT 1: No autonomous spending.
 * The SAR engine cannot spend, transfer, or approve treasury funds
 * without a ratified member vote on record.
 */
export function validateNoAutonomousSpending(action: {
  type: string;
  amount?: number;
  voteId?: string;
}): void {
  if (
    ["payout", "transfer", "disbursement"].includes(action.type) &&
    action.amount &&
    action.amount > 0 &&
    !action.voteId
  ) {
    throw new ConstraintViolation(
      "CONSTRAINT_1",
      "SAR cannot authorize spending without a ratified member vote"
    );
  }
}

/**
 * CONSTRAINT 2: Append-only log.
 * The SAR engine cannot modify any existing SAR log entry.
 */
export function validateAppendOnly(operation: string): void {
  if (operation === "UPDATE" || operation === "DELETE") {
    throw new ConstraintViolation(
      "CONSTRAINT_2",
      "SAR log is append-only — modifications are not permitted"
    );
  }
}

/**
 * CONSTRAINT 3: No vote override.
 * The SAR engine cannot alter or override a completed member vote result.
 */
export function validateNoVoteOverride(vote: {
  status: string;
  modifiedBy?: string;
}): void {
  if (
    (vote.status === "passed" || vote.status === "failed") &&
    vote.modifiedBy === "sar_engine"
  ) {
    throw new ConstraintViolation(
      "CONSTRAINT_3",
      "SAR cannot alter or override a completed vote result"
    );
  }
}

/**
 * CONSTRAINT 5: Prompt injection sandboxing.
 * Sanitize user-submitted content before it enters any AI context.
 */
export function sanitizeUserContent(content: string): string {
  // Strip common prompt injection patterns
  const dangerous = [
    /ignore (?:all )?(?:previous |above )?instructions/gi,
    /you are now/gi,
    /system:\s/gi,
    /\[SYSTEM\]/gi,
    /\[INST\]/gi,
    /<\|(?:system|user|assistant)\|>/gi,
  ];

  let sanitized = content;
  for (const pattern of dangerous) {
    sanitized = sanitized.replace(pattern, "[SANITIZED]");
  }

  return sanitized;
}

/**
 * CONSTRAINT 6: Member record immutability.
 * The SAR engine cannot add, remove, or modify member records.
 */
export function validateMemberImmutability(
  actor: string,
  operation: string
): void {
  if (actor === "sar_engine" && ["INSERT", "UPDATE", "DELETE"].includes(operation)) {
    throw new ConstraintViolation(
      "CONSTRAINT_6",
      "SAR cannot add, remove, or modify member records"
    );
  }
}

/**
 * Constraint violation error.
 */
export class ConstraintViolation extends Error {
  constructor(
    public constraint: string,
    message: string
  ) {
    super(message);
    this.name = "ConstraintViolation";
  }
}
