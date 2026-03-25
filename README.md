# NanoClaw Gmail Email Digest Setup

Automated daily email digest using NanoClaw personal AI agent with Gmail integration.

## What This Does

This setup creates an automated daily email digest that:
- 📧 Fetches your Gmail from the last 24 hours
- 📊 Separates emails into **Internal** (your company domain) and **External**
- 🎯 Prioritizes **Direct emails** (sent only to you) over multi-recipient emails
- 🤖 **AI-powered summaries** - 1-2 sentence summary of each email using Claude
- 🏷️ **Smart tags** - Auto-categorizes as [ACTION NEEDED], [FYI], [MEETING], [RESPONSE NEEDED]
- 🔗 Includes direct Gmail links to open each email
- 💾 Saves a formatted digest file daily
- ⏰ Runs automatically every morning at 8 AM

## Example Output

```
Daily Email Digest - 2026-03-24
======================================================================

📩 INTERNAL EMAILS (@yourdomain.com)
======================================================================

🎯 Direct (Priority)
----------------------------------------
1. [ACTION NEEDED] FROM: Boss <boss@company.com>
   SUBJECT: Important project update
   SUMMARY: Requires your review and approval on the Q2 roadmap by EOD Friday.
   DATE: Today at 9:30am
   LINK: https://mail.google.com/mail/u/0/#inbox/19d2116aede1fab9

👥 Multi-Recipient
----------------------------------------
1. [MEETING] FROM: Team Lead <lead@company.com>
   SUBJECT: Weekly team sync
   SUMMARY: Recurring weekly sync to discuss project status and blockers.
   DATE: Today at 10am
   LINK: https://mail.google.com/mail/u/0/#inbox/19d20d935970fc56

📬 EXTERNAL EMAILS
======================================================================
...
```

## Prerequisites

Before starting, ensure you have:

- ✅ **macOS** (this guide is for Mac; Linux users see nanoclaw docs)
- ✅ **Node.js 20+** (`node --version` to check)
- ✅ **Docker Desktop** installed and running
- ✅ **Anthropic API key** (get at https://console.anthropic.com/settings/keys)
- ✅ **Anthropic API credits** (see [AI Summaries & Credits](#ai-summaries--credits) below)
- ✅ **Google Cloud account** (free tier is fine)
- ✅ **Git** installed

## AI Summaries & Credits

### How AI Summaries Work

The email digest uses Claude AI (Anthropic API) to:
- **Analyze each email** and generate a 1-2 sentence summary
- **Categorize emails** with action tags: `[ACTION NEEDED]`, `[FYI]`, `[MEETING]`, `[RESPONSE NEEDED]`
- **Save you time** - scan 50+ emails in 2 minutes instead of opening each one

### Cost & Credits

**Anthropic API credits required:** Yes

- **Cost:** ~$0.003 per email (very low - about $0.15-0.20 per day for 50-70 emails)
- **Monthly estimate:** ~$5-6 for daily digests
- **Minimum purchase:** $5 gets you ~1,600+ email summaries

**To add credits:**
1. Go to https://console.anthropic.com/settings/billing
2. Click "Add credits" or "Purchase credits"
3. Add $5 (lasts ~1 month) or more

### Fallback Mode (No Credits)

If your API credits are low or expired, the script **still works** but uses fallback mode:
- ✅ All emails are still fetched and organized
- ✅ Gmail links still included
- ✅ Tags default to `[FYI]`
- ⚠️ **SUMMARY** field shows email subject instead of AI summary

**You'll see:** `SUMMARY: Important project update` (just the subject)
**With AI:** `SUMMARY: Requires your review and approval on the Q2 roadmap by EOD Friday.`

The digest is still useful in fallback mode - you just don't get the time-saving AI summaries.

## Quick Start

### 1. Install NanoClaw

```bash
# Clone nanoclaw
cd ~/Claude  # or your preferred location
git clone https://github.com/qwibitai/nanoclaw.git
cd nanoclaw

# Install dependencies
npm install

# Build the code
npm run build
```

### 2. Configure Anthropic API Key

```bash
# Create .env file
echo "ANTHROPIC_API_KEY=your-api-key-here" > .env
```

Replace `your-api-key-here` with your actual API key from https://console.anthropic.com/settings/keys

### 3. Build Docker Container

```bash
cd container
./build.sh
cd ..
```

This takes 5-10 minutes. Wait for "Build complete!" message.

### 4. Add Gmail Integration

```bash
# Add Gmail remote repository
git remote add gmail https://github.com/qwibitai/nanoclaw-gmail.git
git fetch gmail main

# Merge Gmail integration
git merge gmail/main --no-edit

# If conflicts occur, resolve them:
git checkout --theirs package-lock.json
git add package-lock.json

# You may need to manually fix package.json version conflict
# Keep the newer version number (1.2.23 or higher)

git commit -m "Merge Gmail integration"

# Install new dependencies
npm install
npm run build
```

### 5. Set Up Google Cloud OAuth

This is the most detailed step. Follow carefully:

#### A. Enable Gmail API

1. Go to https://console.cloud.google.com
2. Create a new project or select existing
3. In the search bar, type "Gmail API"
4. Click **Gmail API** → Click **Enable**

#### B. Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Choose **External** (unless you have Google Workspace)
3. Fill in required fields:
   - **App name:** "NanoClaw Gmail" (or anything)
   - **User support email:** Your email
   - **Developer contact:** Your email
4. Click **Save and Continue**
5. Skip "Scopes" (click **Save and Continue**)
6. Skip "Test users" (click **Save and Continue**)

#### C. Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
3. Application type: **Desktop app**
4. Name: "NanoClaw Gmail Client"
5. Click **Create**
6. Click **DOWNLOAD JSON** (button with download icon)
7. Save file (it'll be named like `client_secret_xxxxx.json`)

#### D. Install Credentials

```bash
# Create Gmail config directory
mkdir -p ~/.gmail-mcp

# Copy the downloaded file (adjust filename to match yours)
cp ~/Downloads/client_secret_*.json ~/.gmail-mcp/gcp-oauth.keys.json
```

### 6. Authorize Gmail Access

```bash
npx -y @gongrzhe/server-gmail-autoauth-mcp auth
```

This will:
1. Open your browser automatically
2. Ask you to sign in with Google
3. Show a warning "This app isn't verified" - **This is normal!**
   - Click **Advanced**
   - Click **Go to [app name] (unsafe)**
4. Grant permissions
5. See "Authentication completed successfully"

### 7. Rebuild Container with Gmail

```bash
cd container
./build.sh
cd ..
```

### 8. Set Up Email Digest Script

Download the email digest script from this repo:

```bash
# Download email-digest.js to your nanoclaw directory
curl -o email-digest.js https://raw.githubusercontent.com/MmaxwellCB/Nanoclaw_setup_gmail/main/email-digest.js

# Make it executable
chmod +x email-digest.js
```

**Edit the script** to set your company domain:

```bash
nano email-digest.js
```

Find this line:
```javascript
const isInternal = fromEmail.includes('@cloudbees.com');
```

Change `@cloudbees.com` to your company domain (e.g., `@yourcompany.com`)

### 9. Test the Digest Manually

```bash
node email-digest.js
```

You should see:
```
📧 Fetching emails from Gmail...
📨 Processing X emails...
✅ Digest saved to: /Users/[username]/Claude/nanoclaw/Gmail/email-digest-2026-03-24.txt
📊 Internal: X, External: X
```

View your first digest:
```bash
cat ~/Claude/nanoclaw/Gmail/email-digest-$(date +%Y-%m-%d).txt
```

### 10. Schedule Daily Execution

```bash
# Create logs and Gmail directories
mkdir -p ~/Claude/nanoclaw/logs
mkdir -p ~/Claude/nanoclaw/Gmail

# Download the LaunchAgent plist
curl -o ~/Library/LaunchAgents/com.nanoclaw.emaildigest.plist \
  https://raw.githubusercontent.com/MmaxwellCB/Nanoclaw_setup_gmail/main/com.nanoclaw.emaildigest.plist
```

**Edit the plist** to match your paths:

```bash
nano ~/Library/LaunchAgents/com.nanoclaw.emaildigest.plist
```

Update these paths if your nanoclaw is not in `~/Claude/nanoclaw`:
- Line with `/Users/mmaxwell/Claude/nanoclaw/email-digest.js`
- Lines with log file paths

Also update the Node.js path if different:
```bash
which node
```
If it shows something other than `/opt/homebrew/bin/node`, update the plist.

**Load the LaunchAgent:**

```bash
launchctl load ~/Library/LaunchAgents/com.nanoclaw.emaildigest.plist

# Verify it's loaded
launchctl list | grep emaildigest
```

You should see:
```
-    0    com.nanoclaw.emaildigest
```

## Daily Usage

### View Today's Digest

```bash
cat ~/Claude/nanoclaw/Gmail/email-digest-$(date +%Y-%m-%d).txt
```

### Run Manually Anytime

```bash
cd ~/Claude/nanoclaw
node email-digest.js
```

### Using Gmail Links

Each email in the digest includes a direct link to open it in Gmail. You can:

**1. Command+Click (macOS Terminal):**
- Many terminal apps support clickable links
- Hold Command and click the link

**2. Copy-Paste:**
- Select and copy the link
- Paste into your browser

**3. Open digest in browser:**
```bash
# Convert to HTML for clickable links
open ~/Claude/nanoclaw/Gmail/email-digest-$(date +%Y-%m-%d).txt
```

**4. Use VS Code or other editor:**
- Most modern editors make URLs clickable
```bash
code ~/Claude/nanoclaw/Gmail/email-digest-$(date +%Y-%m-%d).txt
```

### Change Schedule Time

Default is 8 AM. To change:

```bash
nano ~/Library/LaunchAgents/com.nanoclaw.emaildigest.plist
```

Change the `Hour` value (0 = midnight, 23 = 11 PM):
```xml
<key>Hour</key>
<integer>9</integer>  <!-- Change to desired hour -->
```

Reload:
```bash
launchctl unload ~/Library/LaunchAgents/com.nanoclaw.emaildigest.plist
launchctl load ~/Library/LaunchAgents/com.nanoclaw.emaildigest.plist
```

## Troubleshooting

### "Module not found" errors

```bash
cd ~/Claude/nanoclaw
npm install
```

### Gmail authorization expired

```bash
rm ~/.gmail-mcp/credentials.json
npx -y @gongrzhe/server-gmail-autoauth-mcp auth
```

### No emails in digest

Normal if you have no emails in the last 24 hours. Test with:
```bash
node email-digest.js
```

### Docker not running

Start Docker Desktop, then rebuild:
```bash
cd ~/Claude/nanoclaw/container
./build.sh
```

### LaunchAgent not running

Check logs:
```bash
tail ~/Claude/nanoclaw/logs/email-digest-error.log
```

Manually test:
```bash
cd ~/Claude/nanoclaw
node email-digest.js
```

### AI summaries showing subject lines only

**Symptom:** SUMMARY field just shows the email subject, not an AI-generated summary

**Cause:** Anthropic API credits are low or expired

**Solution:**
1. Check your credit balance: https://console.anthropic.com/settings/billing
2. Add credits (minimum $5)
3. Run digest again:
```bash
cd ~/Claude/nanoclaw
node email-digest.js
```

**Note:** The digest still works in fallback mode - you just get subject lines instead of AI summaries. Add credits when you want the full AI-powered experience.

### AI summary errors in logs

If you see errors like:
```
Error summarizing email: Your credit balance is too low
```

This is normal when credits are depleted. The script automatically falls back to subject lines and continues working. Simply add credits to your Anthropic account to re-enable AI summaries.

## Advanced: Switching to Slack/Telegram

Once you're comfortable with file-based digests, you can switch to receiving them via Slack or Telegram:

### Telegram Setup

1. Follow instructions in `~/Claude/nanoclaw/.claude/skills/add-telegram/SKILL.md`
2. Start nanoclaw: `npm start`
3. Message your bot:
   ```
   @Andy every day at 8am, check my Gmail for emails from the last 24 hours.
   Create two lists: internal (@yourcompany.com) and external emails.
   Prioritize each list by direct emails first, then multi-recipient.
   Send me the formatted digest.
   ```
4. Disable file-based script:
   ```bash
   launchctl unload ~/Library/LaunchAgents/com.nanoclaw.emaildigest.plist
   ```

### Slack Setup

Same process, but follow `.claude/skills/add-slack/SKILL.md`

## Files in This Repository

- **README.md** - This setup guide
- **nanoclaw_setup_gmail.md** - Detailed session documentation with troubleshooting
- **email-digest.js** - The email digest script
- **com.nanoclaw.emaildigest.plist** - macOS LaunchAgent configuration

## Security Notes

- Your Gmail credentials are stored locally in `~/.gmail-mcp/credentials.json`
- OAuth tokens have limited scope (only Gmail access)
- NanoClaw runs agents in isolated Docker containers
- API keys are stored in `.env` file (never commit to git!)

## Support

- **NanoClaw docs:** https://nanoclaw.dev
- **NanoClaw repo:** https://github.com/qwibitai/nanoclaw
- **Discord:** https://discord.gg/VDdww8qS42

## License

This setup guide is provided as-is. NanoClaw itself is MIT licensed.

## Credits

- NanoClaw by [qwibitai](https://github.com/qwibitai)
- Setup guide created with Claude Sonnet 4.5
- Gmail integration by NanoClaw community

---

**Setup Time:** ~30 minutes (including OAuth setup)

**Questions?** Open an issue on this repo!
