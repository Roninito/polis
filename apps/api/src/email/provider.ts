/**
 * Email service provider — supports Resend, SendGrid, Mailgun, or console fallback.
 */

import { Resend } from "resend";

type EmailProvider = "resend" | "sendgrid" | "mailgun" | "console";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

interface EmailConfig {
  provider: EmailProvider;
  apiKey?: string;
  from: string;
}

let emailConfig: EmailConfig | null = null;

/**
 * Initialize email service with config.
 * If API key is not provided, email sending will fall back to console logging.
 */
export function initializeEmailService(config: EmailConfig): void {
  emailConfig = config;
}

/**
 * Get the current email configuration.
 */
function getEmailConfig(): EmailConfig {
  if (!emailConfig) {
    throw new Error("Email service not initialized. Call initializeEmailService first.");
  }
  return emailConfig;
}

/**
 * Send email via configured provider.
 * Fails gracefully — if provider is down or API key missing, logs error and returns.
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const config = getEmailConfig();

  if (!config.apiKey) {
    // Fallback: log to console if no API key configured
    console.log(
      `[Email] (no API key, console fallback) To: ${options.to}, Subject: ${options.subject}`
    );
    return true;
  }

  try {
    switch (config.provider) {
      case "resend":
        return await sendViaResend(options, config.apiKey, config.from);
      case "sendgrid":
        return await sendViaSendGrid(options, config.apiKey, config.from);
      case "mailgun":
        return await sendViaMailgun(options, config.apiKey, config.from);
      case "console":
        console.log(
          `[Email] To: ${options.to}, Subject: ${options.subject}\n${options.html}`
        );
        return true;
      default:
        console.warn(`[Email] Unknown provider: ${config.provider}`);
        return false;
    }
  } catch (error) {
    console.error(`[Email] Failed to send email to ${options.to}:`, error);
    // Fail gracefully — don't break request
    return false;
  }
}

/**
 * Send via Resend.
 */
async function sendViaResend(
  options: EmailOptions,
  _apiKey: string,
  from: string
): Promise<boolean> {
  const resend = new Resend(_apiKey);

  const result = await resend.emails.send({
    from: options.from || from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }

  return true;
}

/**
 * Send via SendGrid (stub — requires @sendgrid/mail package).
 */
async function sendViaSendGrid(
  options: EmailOptions,
  _apiKey: string,
  _from: string
): Promise<boolean> {
  console.warn("[Email] SendGrid provider not fully implemented. Using console fallback.");
  console.log(
    `[Email] (SendGrid stub) To: ${options.to}, Subject: ${options.subject}`
  );
  return true;
}

/**
 * Send via Mailgun (stub — requires mailgun.js package).
 */
async function sendViaMailgun(
  options: EmailOptions,
  _apiKey: string,
  _from: string
): Promise<boolean> {
  console.warn("[Email] Mailgun provider not fully implemented. Using console fallback.");
  console.log(
    `[Email] (Mailgun stub) To: ${options.to}, Subject: ${options.subject}`
  );
  return true;
}
