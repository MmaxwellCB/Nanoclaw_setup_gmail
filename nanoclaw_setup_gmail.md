# NanoClaw Setup with Gmail Integration - Session Documentation

**Date:** March 24, 2026
**User:** Mark Maxwell (mmaxwell@cloudbees.com)
**Purpose:** Install nanoclaw and create daily email digest for CloudBees emails

---

## Table of Contents

1. [Overview](#overview)
2. [What Was Accomplished](#what-was-accomplished)
3. [Installation Steps](#installation-steps)
4. [Email Digest Configuration](#email-digest-configuration)
5. [Daily Usage](#daily-usage)
6. [Future Enhancements](#future-enhancements)
7. [Troubleshooting](#troubleshooting)
8. [Key File Locations](#key-file-locations)

---

## Overview

NanoClaw is a lightweight personal AI agent that runs Claude Agent SDK in isolated containers. This session focused on:
- Installing and configuring nanoclaw
- Integrating Gmail API access
- Creating an automated daily email digest

The digest separates emails into:
- **Internal** (@cloudbees.com)
- **External** (all others)

And prioritizes each by:
- **Direct** (sent only to you) - Priority
- **Multi-recipient** (CC'd or mailing lists)

---

## What Was Accomplished

### ✅ Task 1: Set Up NanoClaw on Host System
**Location:** `~/Claude/nanoclaw`

1. Cloned repository from https://github.com/qwibitai/nanoclaw.git
2. Installed Node.js dependencies (`npm install`)
3. Created `.env` file with Anthropic API key
4. Built TypeScript code (`npm run build`)

**Status:** ✅ Complete

### ✅ Task 2: Build NanoClaw Docker Container
**Image:** `nanoclaw-agent:latest`

1. Built Docker container using `container/build.sh`
2. Container includes:
   - Node.js 24 (slim)
   - Chromium browser
   - Claude Agent SDK
   - Gmail MCP server integration
3. Image size: 2.41GB (compressed: 697MB)

**Status:** ✅ Complete

### ✅ Task 3: Add Gmail Integration
**Mode:** Tool-only (no automatic email triggers)

1. Added Gmail remote repository
2. Merged Gmail integration branch
3. Installed `googleapis` npm package
4. Set up Google Cloud OAuth credentials
   - Enabled Gmail API
   - Created OAuth Desktop app
   - Downloaded credentials to `~/.gmail-mcp/`
5. Authorized Gmail access via OAuth flow
6. Rebuilt container with Gmail MCP server

**Connected Email:** mmaxwell@cloudbees.com

**Status:** ✅ Complete

### ✅ Task 4: Create Daily Email Digest Scheduled Task
**Script:** `email-digest.js`
**Schedule:** Daily at 8:00 AM
**Output:** `email-digest-YYYY-MM-DD.txt`

1. Created Node.js script using Gmail API
2. Implemented email categorization logic:
   - Internal (@cloudbees.com) vs External
   - Direct vs Multi-recipient
3. Created macOS LaunchAgent for daily execution
4. Tested successfully with 71 emails (19 internal, 52 external)

**Status:** ✅ Complete

---

## Installation Steps

### Prerequisites
- macOS or Linux
- Node.js 20+
- Docker Desktop
- Anthropic API key
- Google Cloud OAuth credentials

### Step-by-Step Installation

#### 1. Clone and Install NanoClaw
```bash
cd ~/Claude
git clone https://github.com/qwibitai/nanoclaw.git
cd nanoclaw
npm install
```

#### 2. Configure API Key
```bash
# Create .env file
cat > .env << 'EOF'
ANTHROPIC_API_KEY=sk-ant-api03-[YOUR_KEY_HERE]
EOF
```

#### 3. Build NanoClaw
```bash
npm run build
```

#### 4. Build Docker Container
```bash
cd container
./build.sh
cd ..
```

#### 5. Add Gmail Integration
```bash
# Add Gmail remote
git remote add gmail https://github.com/qwibitai/nanoclaw-gmail.git
git fetch gmail main

# Merge Gmail integration
git merge gmail/main --no-edit

# Resolve conflicts
git checkout --theirs package-lock.json
git add package-lock.json

# Fix package.json version conflict (keep 1.2.23)
# Fix repo-tokens/badge.svg conflict (keep current version)
git add package.json repo-tokens/badge.svg
git commit -m "Merge Gmail integration for tool-only mode"

# Install dependencies and rebuild
npm install
npm run build
```

#### 6. Set Up Google Cloud OAuth

1. Visit https://console.cloud.google.com
2. Create/select project
3. Enable Gmail API (APIs & Services > Library)
4. Create OAuth credentials:
   - APIs & Services > Credentials
   - Create OAuth client ID
   - Type: Desktop app
   - Download JSON
5. Copy credentials:
```bash
mkdir -p ~/.gmail-mcp
cp ~/Downloads/client_secret_*.json ~/.gmail-mcp/gcp-oauth.keys.json
```

#### 7. Authorize Gmail Access
```bash
npx -y @gongrzhe/server-gmail-autoauth-mcp auth
```
- Browser opens automatically
- Sign in with Google account
- Grant Gmail access
- If "app isn't verified" warning: Click Advanced > Go to [app name] (unsafe)

#### 8. Rebuild Container with Gmail
```bash
cd container
./build.sh
cd ..
```

#### 9. Set Up Daily Email Digest

The script is already created at `~/Claude/nanoclaw/email-digest.js`

Create LaunchAgent:
```bash
# File already created at:
# ~/Library/LaunchAgents/com.nanoclaw.emaildigest.plist

# Load the agent
launchctl load ~/Library/LaunchAgents/com.nanoclaw.emaildigest.plist

# Verify it's loaded
launchctl list | grep emaildigest
```

---

## Email Digest Configuration

### How It Works

The `email-digest.js` script:
1. Connects to Gmail API using OAuth credentials
2. Fetches emails from last 24 hours
3. Categorizes each email:
   - **Internal** if from `@cloudbees.com`
   - **External** if from any other domain
   - **Direct** if sent only to you (no CC, single recipient)
   - **Multi-recipient** if CC'd or multiple recipients
4. Generates formatted text file
5. Saves to `email-digest-YYYY-MM-DD.txt`

### Output Format

```
Daily Email Digest - 2026-03-24
======================================================================

📩 INTERNAL EMAILS (@cloudbees.com)
======================================================================

🎯 Direct (Priority)
----------------------------------------
1. FROM: Christopher Allen <callen@cloudbees.com>
   SUBJECT: Invitation: connect about BHN CVR/ BVA
   DATE: Tue, 24 Mar 2026 3:30pm

2. FROM: David Astor <dastor@cloudbees.com>
   SUBJECT: Accepted: David & Mark Check in
   DATE: Tue, 24 Mar 2026 10am

👥 Multi-Recipient
----------------------------------------
1. FROM: Jordan Adams <jadams@cloudbees.com>
   SUBJECT: Invitation: GE Healthcare Internal Prep
   DATE: Thu, 26 Mar 2026 11:30am

...

📬 EXTERNAL EMAILS
======================================================================

🎯 Direct (Priority)
----------------------------------------
1. FROM: Gong <do-not-reply@gong.io>
   SUBJECT: Call recording is ready
   DATE: Tue, 24 Mar 2026 8:08pm

👥 Multi-Recipient/Lists
----------------------------------------
1. FROM: Techstrong.AI <newsletters@techstronggroup.com>
   SUBJECT: Latest updates: AI war signals
   DATE: Tue, 24 Mar 2026 5:39pm

...
```

### Schedule Details

- **When:** Daily at 8:00 AM
- **How:** macOS LaunchAgent (`com.nanoclaw.emaildigest`)
- **Logs:**
  - Standard output: `~/Claude/nanoclaw/logs/email-digest.log`
  - Errors: `~/Claude/nanoclaw/logs/email-digest-error.log`

---

## Daily Usage

### View Today's Digest
```bash
# Quick view
cat ~/Claude/nanoclaw/email-digest-$(date +%Y-%m-%d).txt

# Open in editor
open ~/Claude/nanoclaw/email-digest-$(date +%Y-%m-%d).txt
```

### Run Manually Anytime
```bash
cd ~/Claude/nanoclaw
node email-digest.js
```

### Check Schedule Status
```bash
# Verify LaunchAgent is loaded
launchctl list | grep emaildigest

# Should show:
# -    0    com.nanoclaw.emaildigest
```

### View Logs
```bash
# Standard output
tail -f ~/Claude/nanoclaw/logs/email-digest.log

# Errors
tail -f ~/Claude/nanoclaw/logs/email-digest-error.log
```

### Change Schedule Time

1. Edit the plist file:
```bash
nano ~/Library/LaunchAgents/com.nanoclaw.emaildigest.plist
```

2. Modify the `Hour` value (0-23):
```xml
<key>StartCalendarInterval</key>
<dict>
    <key>Hour</key>
    <integer>9</integer>  <!-- Change to desired hour -->
    <key>Minute</key>
    <integer>0</integer>
</dict>
```

3. Reload:
```bash
launchctl unload ~/Library/LaunchAgents/com.nanoclaw.emaildigest.plist
launchctl load ~/Library/LaunchAgents/com.nanoclaw.emaildigest.plist
```

### Disable/Enable Daily Run

**Disable:**
```bash
launchctl unload ~/Library/LaunchAgents/com.nanoclaw.emaildigest.plist
```

**Enable:**
```bash
launchctl load ~/Library/LaunchAgents/com.nanoclaw.emaildigest.plist
```

---

## Future Enhancements

### Switching to Slack/Telegram Delivery

Currently, digests are saved to text files. When ready to receive via messaging:

#### Option 1: Telegram

1. **Install Telegram channel:**
```bash
cd ~/Claude/nanoclaw
# Follow instructions in .claude/skills/add-telegram/SKILL.md
```

2. **Start nanoclaw:**
```bash
npm start
```

3. **Create scheduled task via Telegram:**
Message your bot:
```
@Andy every day at 8am, check my Gmail for emails from the last 24 hours.
Create two lists: internal (@cloudbees.com) and external emails.
Prioritize each list by direct emails first, then multi-recipient.
Send me the formatted digest.
```

4. **Disable file-based script:**
```bash
launchctl unload ~/Library/LaunchAgents/com.nanoclaw.emaildigest.plist
```

#### Option 2: Slack

Same process, but follow `.claude/skills/add-slack/SKILL.md`

### Full Channel Mode

Currently using **tool-only mode** (agent only checks Gmail when asked).

To enable **full channel mode** (incoming emails trigger agent):
1. Follow Gmail integration instructions for channel mode
2. Agent will respond to incoming emails automatically
3. Useful for auto-responses or email processing

---

## Troubleshooting

### Email Digest Not Running

**Check if LaunchAgent is loaded:**
```bash
launchctl list | grep emaildigest
```

**Check logs:**
```bash
tail ~/Claude/nanoclaw/logs/email-digest-error.log
```

**Manually test:**
```bash
cd ~/Claude/nanoclaw
node email-digest.js
```

### Gmail Authorization Expired

**Symptoms:**
- Script fails with 401 error
- "Authentication failed" message

**Solution:**
```bash
# Remove old credentials
rm ~/.gmail-mcp/credentials.json

# Re-authorize
npx -y @gongrzhe/server-gmail-autoauth-mcp auth
```

### No Emails in Digest

**Possible causes:**
- No emails in last 24 hours (normal)
- Gmail authorization expired (see above)
- Gmail API quota exceeded (unlikely with personal use)

**Check:**
```bash
# Test Gmail access directly
npx -y @gongrzhe/server-gmail-autoauth-mcp
```

### Docker Build Fails

**Ensure Docker is running:**
```bash
docker info
```

**Rebuild:**
```bash
cd ~/Claude/nanoclaw/container
./build.sh
```

### Module Not Found Errors

**Reinstall dependencies:**
```bash
cd ~/Claude/nanoclaw
npm install
```

### NanoClaw Service Issues

**Check status:**
```bash
cd ~/Claude/nanoclaw
npm start
```

**View logs:**
```bash
tail -f ~/Claude/nanoclaw/logs/nanoclaw.log
```

---

## Key File Locations

### NanoClaw Core
- **Installation:** `~/Claude/nanoclaw/`
- **Configuration:** `~/Claude/nanoclaw/.env`
- **Built code:** `~/Claude/nanoclaw/dist/`
- **Logs:** `~/Claude/nanoclaw/logs/`

### Email Digest
- **Script:** `~/Claude/nanoclaw/email-digest.js`
- **Output files:** `~/Claude/nanoclaw/email-digest-YYYY-MM-DD.txt`
- **LaunchAgent:** `~/Library/LaunchAgents/com.nanoclaw.emaildigest.plist`
- **Logs:** `~/Claude/nanoclaw/logs/email-digest*.log`

### Gmail Integration
- **Credentials:** `~/.gmail-mcp/credentials.json`
- **OAuth keys:** `~/.gmail-mcp/gcp-oauth.keys.json`
- **Channel code:** `~/Claude/nanoclaw/src/channels/gmail.ts`
- **Tests:** `~/Claude/nanoclaw/src/channels/gmail.test.ts`

### Docker
- **Dockerfile:** `~/Claude/nanoclaw/container/Dockerfile`
- **Build script:** `~/Claude/nanoclaw/container/build.sh`
- **Agent runner:** `~/Claude/nanoclaw/container/agent-runner/`
- **Image:** `nanoclaw-agent:latest` (use `docker images`)

---

## Testing Results

### First Digest Run (March 24, 2026)
- **Total emails:** 71
- **Internal (@cloudbees.com):** 19
  - Direct: 2
  - Multi-recipient: 17
- **External:** 52
  - Direct: Various
  - Multi-recipient: Various

**Output file:** `email-digest-2026-03-24.txt` (12KB)

### Gmail Connection Test
```
[17:47:56.977] INFO: Gmail channel connected
  email: "mmaxwell@cloudbees.com"
```

---

## Quick Reference Commands

```bash
# View today's digest
cat ~/Claude/nanoclaw/email-digest-$(date +%Y-%m-%d).txt

# Run digest manually
cd ~/Claude/nanoclaw && node email-digest.js

# Check schedule status
launchctl list | grep emaildigest

# View logs
tail ~/Claude/nanoclaw/logs/email-digest.log

# Test Gmail access
npx -y @gongrzhe/server-gmail-autoauth-mcp auth

# Rebuild Docker container
cd ~/Claude/nanoclaw/container && ./build.sh

# Start nanoclaw service
cd ~/Claude/nanoclaw && npm start

# Build nanoclaw
cd ~/Claude/nanoclaw && npm run build
```

---

## Summary

This session successfully:
1. ✅ Installed nanoclaw personal AI agent
2. ✅ Built Docker container for isolated agent execution
3. ✅ Integrated Gmail API with OAuth authentication
4. ✅ Created automated daily email digest
5. ✅ Scheduled digest to run every morning at 8 AM
6. ✅ Tested with real emails (71 processed successfully)

The email digest is now fully operational and will run automatically every morning, providing prioritized lists of internal and external emails from the previous 24 hours.

Future enhancements can include switching from file output to Slack/Telegram messaging when ready.

---

**Session completed:** March 24, 2026, 5:49 PM CDT
**Documentation by:** Claude Sonnet 4.5
