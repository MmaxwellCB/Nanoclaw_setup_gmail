#!/usr/bin/env node
/**
 * Daily Email Digest Script
 *
 * Fetches emails from Gmail, separates into:
 * 1. Internal emails (@cloudbees.com)
 * 2. External emails
 *
 * Each list is prioritized:
 * 1. Direct emails (sent only to you)
 * 2. Multi-recipient emails (cc/bcc or lists)
 *
 * Output is saved to: Gmail/email-digest-YYYY-MM-DD.txt
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Get today's date for filename
const today = new Date().toISOString().split('T')[0];
const gmailDir = path.join(__dirname, 'Gmail');
const outputFile = path.join(gmailDir, `email-digest-${today}.txt`);

async function main() {
  try {
    console.log('📧 Fetching emails from Gmail...');

    // Load Gmail credentials
    const credentialsPath = path.join(os.homedir(), '.gmail-mcp', 'credentials.json');
    const keysPath = path.join(os.homedir(), '.gmail-mcp', 'gcp-oauth.keys.json');

    if (!fs.existsSync(credentialsPath)) {
      console.error('❌ Gmail credentials not found. Please run Gmail authorization first.');
      process.exit(1);
    }

    // Ensure Gmail output directory exists
    if (!fs.existsSync(gmailDir)) {
      fs.mkdirSync(gmailDir, { recursive: true });
    }

    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
    const keys = JSON.parse(fs.readFileSync(keysPath, 'utf-8'));

    // Set up OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      keys.installed.client_id,
      keys.installed.client_secret,
      keys.installed.redirect_uris[0]
    );

    oauth2Client.setCredentials(credentials);

    // Create Gmail API client
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Get yesterday's date for filtering
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0].replace(/-/g, '/');

    // Fetch messages from the last 24 hours
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: `after:${yesterdayStr}`,
      maxResults: 100
    });

    const messages = response.data.messages || [];

    if (messages.length === 0) {
      console.log('📭 No recent emails found.');
      const output = `Daily Email Digest - ${today}\n${'='.repeat(50)}\n\n✅ No emails from the last 24 hours.\n`;
      fs.writeFileSync(outputFile, output);
      console.log(`✅ Digest saved to: ${outputFile}`);
      return;
    }

    console.log(`📨 Processing ${messages.length} emails...`);

    // Fetch full details for each message
    const emails = [];
    for (const message of messages) {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'full'
      });

      const headers = msg.data.payload.headers;
      const email = {
        from: getHeader(headers, 'From'),
        to: getHeader(headers, 'To'),
        cc: getHeader(headers, 'Cc'),
        subject: getHeader(headers, 'Subject'),
        date: getHeader(headers, 'Date')
      };

      emails.push(email);
    }

    // Separate and prioritize emails
    const { internalDirect, internalMulti, externalDirect, externalMulti } = categorizeEmails(emails);

    // Generate digest
    const digest = generateDigest(today, internalDirect, internalMulti, externalDirect, externalMulti);

    // Write to file
    fs.writeFileSync(outputFile, digest);
    console.log(`✅ Digest saved to: ${outputFile}`);
    console.log(`📊 Internal: ${internalDirect.length + internalMulti.length}, External: ${externalDirect.length + externalMulti.length}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 401) {
      console.error('⚠️  Gmail authorization expired. Please re-authorize:');
      console.error('   rm ~/.gmail-mcp/credentials.json');
      console.error('   npx -y @gongrzhe/server-gmail-autoauth-mcp auth');
    }
    process.exit(1);
  }
}

/**
 * Get header value from Gmail message headers
 */
function getHeader(headers, name) {
  const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return header ? header.value : '';
}

/**
 * Extract email address from "Name <email@domain.com>" format
 */
function extractEmail(str) {
  if (!str) return '';
  const match = str.match(/<(.+?)>/);
  return match ? match[1] : str;
}

/**
 * Categorize emails into internal/external and direct/multi-recipient
 */
function categorizeEmails(emails) {
  const internalDirect = [];
  const internalMulti = [];
  const externalDirect = [];
  const externalMulti = [];

  for (const email of emails) {
    const fromEmail = extractEmail(email.from);
    const isInternal = fromEmail.includes('@cloudbees.com');
    const isDirect = isDirectEmail(email);

    if (isInternal) {
      if (isDirect) {
        internalDirect.push(email);
      } else {
        internalMulti.push(email);
      }
    } else {
      if (isDirect) {
        externalDirect.push(email);
      } else {
        externalMulti.push(email);
      }
    }
  }

  return { internalDirect, internalMulti, externalDirect, externalMulti };
}

/**
 * Check if email is direct (sent only to you) vs multi-recipient
 */
function isDirectEmail(email) {
  // If there are CC recipients, it's multi-recipient
  if (email.cc && email.cc.trim().length > 0) return false;

  // If TO has multiple recipients, it's multi-recipient
  const toAddresses = email.to.split(',').filter(a => a.trim().length > 0);
  if (toAddresses.length > 1) return false;

  return true;
}

/**
 * Generate formatted digest
 */
function generateDigest(date, internalDirect, internalMulti, externalDirect, externalMulti) {
  let output = `Daily Email Digest - ${date}\n`;
  output += '='.repeat(70) + '\n\n';

  // Internal Emails Section
  output += '📩 INTERNAL EMAILS (@cloudbees.com)\n';
  output += '='.repeat(70) + '\n\n';

  if (internalDirect.length > 0) {
    output += '🎯 Direct (Priority)\n';
    output += '-'.repeat(40) + '\n';
    internalDirect.forEach((email, idx) => {
      output += `${idx + 1}. FROM: ${email.from}\n`;
      output += `   SUBJECT: ${email.subject}\n`;
      output += `   DATE: ${email.date}\n\n`;
    });
  }

  if (internalMulti.length > 0) {
    output += '👥 Multi-Recipient\n';
    output += '-'.repeat(40) + '\n';
    internalMulti.forEach((email, idx) => {
      output += `${idx + 1}. FROM: ${email.from}\n`;
      output += `   SUBJECT: ${email.subject}\n`;
      output += `   DATE: ${email.date}\n\n`;
    });
  }

  if (internalDirect.length === 0 && internalMulti.length === 0) {
    output += '✅ No internal emails\n\n';
  }

  // External Emails Section
  output += '\n📬 EXTERNAL EMAILS\n';
  output += '='.repeat(70) + '\n\n';

  if (externalDirect.length > 0) {
    output += '🎯 Direct (Priority)\n';
    output += '-'.repeat(40) + '\n';
    externalDirect.forEach((email, idx) => {
      output += `${idx + 1}. FROM: ${email.from}\n`;
      output += `   SUBJECT: ${email.subject}\n`;
      output += `   DATE: ${email.date}\n\n`;
    });
  }

  if (externalMulti.length > 0) {
    output += '👥 Multi-Recipient/Lists\n';
    output += '-'.repeat(40) + '\n';
    externalMulti.forEach((email, idx) => {
      output += `${idx + 1}. FROM: ${email.from}\n`;
      output += `   SUBJECT: ${email.subject}\n`;
      output += `   DATE: ${email.date}\n\n`;
    });
  }

  if (externalDirect.length === 0 && externalMulti.length === 0) {
    output += '✅ No external emails\n\n';
  }

  output += '\n' + '='.repeat(70) + '\n';
  output += `Total: ${internalDirect.length + internalMulti.length + externalDirect.length + externalMulti.length} emails\n`;
  output += `Generated: ${new Date().toLocaleString()}\n`;

  return output;
}

main();
