# Setup — from this zip to an overnight build, then a link for friends

## A. Put the kit on GitHub (5 min)

1. On GitHub, create a new **private** repository, for example `doorway`. Leave it empty: no README, license or .gitignore.
2. Unzip the kit and push it:

   ```bash
   unzip doorway-kit.zip -d doorway
   cd doorway
   git init -b main
   git add .
   git commit -m "Spec, rulings, design and build prompt"
   git remote add origin https://github.com/<you>/doorway.git
   git push -u origin main
   ```

3. Give Claude access to the repo. Open https://github.com/apps/claude → **Configure** (or **Install**) → your account → **Only select repositories** → add `doorway` → **Save**.

   Private repos are reachable by cloud sessions only when the Claude GitHub App is installed on them. If you went through claude.ai/code onboarding before, check that this new repo is in the app's list.

## B. Configure the cloud environment (5 min)

At https://claude.ai/code, open the **environment selector**: the first control under the message box. Choose **New environment** (or hover over your existing one and click its settings icon), then fill in:

- **Name:** `doorway-overnight`
- **Network access:** **Custom**
  - Tick **Also include default list of common package managers**. This covers npm, GitHub, Google Fonts and Prisma binaries.
  - Under **Allowed domains**, add the Playwright browser download hosts, which are not in the default list:

    ```
    cdn.playwright.dev
    playwright.download.prss.microsoft.com
    playwright.azureedge.net
    ```

- **Environment variables** (`.env` format). These lengthen command timeouts so long test and simulation steps don't get cut:

  ```
  BASH_DEFAULT_TIMEOUT_MS=600000
  BASH_MAX_TIMEOUT_MS=1800000
  ```

- **Setup script:** leave it empty. Node 22, pnpm, Docker and PostgreSQL 16 are pre-installed, and the session installs everything else itself.

Save with **Add environment**.

## C. Start the overnight session (2 min)

1. On the new-session screen, pick the repo `doorway`, branch `main`, and environment `doorway-overnight`.
2. Pick your strongest model.
3. Set the permission mode to **Auto**, in the dropdown under the prompt box. Auto is the mode for long unattended runs: it doesn't stop for approvals.
   - If Auto isn't offered, use **Accept edits**. The session may then pause on some commands; check it once before bed.
   - Bypass permissions isn't available in cloud sessions.
4. Paste the contents of `BUILD_PROMPT.md` as the first message and send it.
5. Watch the first 10–15 minutes until `STATUS.md` shows M1 pushed. After that you can close the tab; the session keeps running in the cloud.

**In the morning:**
- Open the session at claude.ai/code. Read `STATUS.md` on the session's branch, then the pull request.
- If anything is left, reply in the same session, for example "continue from STATUS.md". Your credits run until **Thu 5 Nov, about 13:30 IST**, and the prompt tells the session to have everything pushed by 12:30 IST.

## D. Deploy and share (about 10 min, after you merge the PR)

The repo's `DEPLOY.md` is the authoritative version, because the build writes and tests it against the real code. The outline:

1. **Merge** the overnight pull request into `main`.
2. **Vercel → Add New → Project →** import `doorway`. Set the **Root Directory** and build command exactly as `DEPLOY.md` says. The web app lives in `apps/web`, and migrations run with `prisma migrate deploy` during the build.
3. **Add Neon:** open the Neon integration on the Vercel Marketplace and click **Install**, then create the database.
   - Then go to **Storage → your database → Connect Project**, pick this project, and tick **Development, Preview, Production**.
   - This injects `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct).
   - Optional: tick **Preview** under "Create database branch for deployment" so preview deploys get their own copy of the database.
4. **Project → Settings → Environment Variables**, add:
   - `DASHBOARD_PASSWORD`: your password for `/designer`;
   - `SESSION_SECRET`: the output of `openssl rand -hex 32`.
5. **Deploy**, or redeploy so the variables apply.
6. **Smoke test.**
   - Open `https://<your-app>.vercel.app` on your phone. Create a room, fill a seat with a bot, and open the room link in a second browser to join with a nickname.
   - Open `/designer`, enter your password, and check the Analysis page.
7. **Send friends** the room link, `…/r/<CODE>`. They only need a nickname.
