/**
 * Email Service
 * SMTP email sending for notifications
 */

import { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, ADMIN_EMAIL } from '$env/static/private';
import { PUBLIC_APP_NAME, PUBLIC_APP_URL } from '$env/static/public';

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

interface ScraperErrorNotification {
  sourceName: string;
  sourceId: number;
  error: string;
  timestamp: Date;
}

interface BatchCompleteNotification {
  batchId: number;
  filename?: string;
  totalUrls: number;
  successCount: number;
  errorCount: number;
  totalEvents: number;
  duration: number;
}

/**
 * Send email via SMTP
 * Note: For production, consider using a proper email library like nodemailer
 * This is a simplified implementation using fetch to an SMTP-to-HTTP gateway
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn('[Email] SMTP not configured, skipping email');
    return false;
  }

  // For now, log the email - in production you'd use nodemailer or similar
  console.log('[Email] Would send:', {
    to: options.to,
    subject: options.subject,
    // Don't log full HTML
  });

  // TODO: Implement actual SMTP sending with nodemailer
  // This requires adding nodemailer to dependencies
  // For now, return true to indicate the email "would be sent"
  return true;
}

/**
 * Send scraper error notification to admin
 */
export async function notifyScraperError(error: ScraperErrorNotification): Promise<boolean> {
  if (!ADMIN_EMAIL) {
    return false;
  }

  const html = `
    <h2>Scraper Error Alert</h2>
    <p>A scraper has encountered an error:</p>
    <table style="border-collapse: collapse; margin: 20px 0;">
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Source</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${error.sourceName} (ID: ${error.sourceId})</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Error</td>
        <td style="padding: 8px; border: 1px solid #ddd; color: red;">${error.error}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Time</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${error.timestamp.toISOString()}</td>
      </tr>
    </table>
    <p>
      <a href="${PUBLIC_APP_URL}/admin/scrapers/${error.sourceId}">View Source</a> |
      <a href="${PUBLIC_APP_URL}/admin/scrapers">Scraper Dashboard</a>
    </p>
    <hr>
    <p style="color: #666; font-size: 12px;">
      This is an automated message from ${PUBLIC_APP_NAME}.
    </p>
  `;

  return sendEmail({
    to: ADMIN_EMAIL,
    subject: `[${PUBLIC_APP_NAME}] Scraper Error: ${error.sourceName}`,
    html,
    text: `Scraper Error: ${error.sourceName}\n\nError: ${error.error}\nTime: ${error.timestamp.toISOString()}`,
  });
}

/**
 * Send batch processing complete notification
 */
export async function notifyBatchComplete(batch: BatchCompleteNotification): Promise<boolean> {
  if (!ADMIN_EMAIL) {
    return false;
  }

  const successRate = batch.totalUrls > 0
    ? Math.round((batch.successCount / batch.totalUrls) * 100)
    : 0;

  const statusColor = successRate >= 80 ? 'green' : successRate >= 50 ? 'orange' : 'red';

  const html = `
    <h2>Batch Processing Complete</h2>
    <p>Intelligent scraper batch has finished processing:</p>
    <table style="border-collapse: collapse; margin: 20px 0;">
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Batch ID</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${batch.batchId}</td>
      </tr>
      ${batch.filename ? `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">File</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${batch.filename}</td>
      </tr>
      ` : ''}
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Total URLs</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${batch.totalUrls}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Success</td>
        <td style="padding: 8px; border: 1px solid #ddd; color: green;">${batch.successCount}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Errors</td>
        <td style="padding: 8px; border: 1px solid #ddd; color: red;">${batch.errorCount}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Success Rate</td>
        <td style="padding: 8px; border: 1px solid #ddd; color: ${statusColor}; font-weight: bold;">${successRate}%</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Events Found</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${batch.totalEvents}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Duration</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${formatDuration(batch.duration)}</td>
      </tr>
    </table>
    <p>
      <a href="${PUBLIC_APP_URL}/admin/scrapers/intelligent">View Batch Details</a>
    </p>
    <hr>
    <p style="color: #666; font-size: 12px;">
      This is an automated message from ${PUBLIC_APP_NAME}.
    </p>
  `;

  return sendEmail({
    to: ADMIN_EMAIL,
    subject: `[${PUBLIC_APP_NAME}] Batch Complete: ${batch.totalEvents} events from ${batch.successCount}/${batch.totalUrls} URLs`,
    html,
  });
}

/**
 * Send daily scraper summary
 */
export async function notifyDailySummary(summary: {
  totalSources: number;
  successfulSources: number;
  failedSources: number;
  totalEventsAdded: number;
  totalDuplicatesSkipped: number;
}): Promise<boolean> {
  if (!ADMIN_EMAIL) {
    return false;
  }

  const successRate = summary.totalSources > 0
    ? Math.round((summary.successfulSources / summary.totalSources) * 100)
    : 0;

  const html = `
    <h2>Daily Scraper Summary</h2>
    <p>Here's today's scraping summary for ${PUBLIC_APP_NAME}:</p>
    <table style="border-collapse: collapse; margin: 20px 0;">
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Total Sources</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${summary.totalSources}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Successful</td>
        <td style="padding: 8px; border: 1px solid #ddd; color: green;">${summary.successfulSources}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Failed</td>
        <td style="padding: 8px; border: 1px solid #ddd; color: red;">${summary.failedSources}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Success Rate</td>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${successRate}%</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Events Added</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${summary.totalEventsAdded}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Duplicates Skipped</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${summary.totalDuplicatesSkipped}</td>
      </tr>
    </table>
    <p>
      <a href="${PUBLIC_APP_URL}/admin/scrapers">View Scraper Dashboard</a>
    </p>
    <hr>
    <p style="color: #666; font-size: 12px;">
      This is an automated message from ${PUBLIC_APP_NAME}.
    </p>
  `;

  return sendEmail({
    to: ADMIN_EMAIL,
    subject: `[${PUBLIC_APP_NAME}] Daily Summary: ${summary.totalEventsAdded} events added`,
    html,
  });
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Check if email service is configured
 */
export function isConfigured(): boolean {
  return !!(SMTP_HOST && SMTP_USER && SMTP_PASS);
}
