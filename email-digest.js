#!/usr/bin/env node
/**
 * Daily Email Digest Script with AI Summaries
 *
 * Fetches emails from Gmail, separates into:
 * 1. Internal emails (@cloudbees.com)
 * 2. External emails
 *
 * Each list is prioritized:
 * 1. Direct emails (sent only to you)
 * 2. Multi-recipient emails (cc/bcc or lists)
 *
 * Uses Claude AI to generate:
 * - 1-2 sentence summaries for each email
 * - Action tags: [ACTION NEEDED], [FYI], [MEETING], [RESPONSE NEEDED]
 *
 * Output is saved to: Gmail/email-digest-YYYY-MM-DD.txt
 */

import { google } from 'googleapis';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Get today's date for filename
const today = new Date().toISOString().split('T')[0];
const gmailDir = path.join(__dirname, 'Gmail');
const outputFile = path.join(gmailDir, `email-digest-${today}.txt`);

// Load environment variables
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...values] = line.split('=');
    if (key && values.length) {
      process.env[key.trim()] = values.join('=').trim();
    }
  });
}

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Extract plain text body from Gmail message
 */
function getEmailBody(payload) {
  let body = '';

  // Check if there's a direct body
  if (payload.body && payload.body.data) {
    body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
  }

  // Check multipart messages
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body && part.body.data) {
        body += Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.mimeType === 'text/html' && !body && part.body && part.body.data) {
        // Fallback to HTML if no plain text
        const html = Buffer.from(part.body.data, 'base64').toString('utf-8');
        // Simple HTML strip (just remove tags)
        body = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      } else if (part.parts) {
        // Recursive for nested parts
        body += getEmailBody(part);
      }
    }
  }

  // Limit body length to avoid huge API calls
  return body.substring(0, 3000).trim();
}

/**
 * Generate summary and action tag for an email using Claude
 */
async function summarizeEmail(email) {
  try {
    const prompt = `Analyze this email and provide:
1. A 1-2 sentence summary
2. An action tag: [ACTION NEEDED], [FYI], [MEETING], or [RESPONSE NEEDED]

Email Details:
FROM: ${email.from}
SUBJECT: ${email.subject}
BODY: ${email.body}

Format your response as:
TAG: [tag here]
SUMMARY: summary here`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const response = message.content[0].text;

    // Parse the response
    const tagMatch = response.match(/TAG:\s*(\[.*?\])/);
    const summaryMatch = response.match(/SUMMARY:\s*(.+?)$/s);

    return {
      tag: tagMatch ? tagMatch[1] : '[FYI]',
      summary: summaryMatch ? summaryMatch[1].trim() : 'Email summary unavailable'
    };
  } catch (error) {
    // Silently fall back to subject line if API unavailable
    return {
      tag: '[FYI]',
      summary: email.subject
    };
  }
}

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
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'full'
      });

      const headers = msg.data.payload.headers;
      const body = getEmailBody(msg.data.payload);

      const email = {
        id: message.id,
        from: getHeader(headers, 'From'),
        to: getHeader(headers, 'To'),
        cc: getHeader(headers, 'Cc'),
        subject: getHeader(headers, 'Subject'),
        date: getHeader(headers, 'Date'),
        body: body,
        link: `https://mail.google.com/mail/u/0/#inbox/${message.id}`
      };

      // Generate AI summary (skip if API unavailable)
      console.log(`   Processing ${i + 1}/${messages.length}: ${email.from.substring(0, 30)}...`);
      try {
        const { tag, summary } = await summarizeEmail(email);
        email.tag = tag;
        email.summary = summary;
      } catch (error) {
        // Fallback if AI summary fails
        email.tag = '[FYI]';
        email.summary = email.subject; // Use subject as fallback
      }

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
      output += `${idx + 1}. ${email.tag} FROM: ${email.from}\n`;
      output += `   SUBJECT: ${email.subject}\n`;
      output += `   SUMMARY: ${email.summary}\n`;
      output += `   DATE: ${email.date}\n`;
      output += `   LINK: ${email.link}\n\n`;
    });
  }

  if (internalMulti.length > 0) {
    output += '👥 Multi-Recipient\n';
    output += '-'.repeat(40) + '\n';
    internalMulti.forEach((email, idx) => {
      output += `${idx + 1}. ${email.tag} FROM: ${email.from}\n`;
      output += `   SUBJECT: ${email.subject}\n`;
      output += `   SUMMARY: ${email.summary}\n`;
      output += `   DATE: ${email.date}\n`;
      output += `   LINK: ${email.link}\n\n`;
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
      output += `${idx + 1}. ${email.tag} FROM: ${email.from}\n`;
      output += `   SUBJECT: ${email.subject}\n`;
      output += `   SUMMARY: ${email.summary}\n`;
      output += `   DATE: ${email.date}\n`;
      output += `   LINK: ${email.link}\n\n`;
    });
  }

  if (externalMulti.length > 0) {
    output += '👥 Multi-Recipient/Lists\n';
    output += '-'.repeat(40) + '\n';
    externalMulti.forEach((email, idx) => {
      output += `${idx + 1}. ${email.tag} FROM: ${email.from}\n`;
      output += `   SUBJECT: ${email.subject}\n`;
      output += `   SUMMARY: ${email.summary}\n`;
      output += `   DATE: ${email.date}\n`;
      output += `   LINK: ${email.link}\n\n`;
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
