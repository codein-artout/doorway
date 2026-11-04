# Starting the v2 build

`main` already has v1. This kit adds only new files. It changes nothing that's already in the repo.

```
design/v2/DESIGN-v2.md
design/v2/screens/   (8 mockups)
BUILD_PROMPT-v2.md
SETUP-v2.md
```

## 1. Add the kit to `main` (pick one)

**On the GitHub website, no terminal needed**
1. Unzip `doorway-v2-kit.zip` on your computer.
2. In the repo on GitHub, click **Add file → Upload files**.
3. Drag in the **contents** of the unzipped folder: the `design` folder plus the two `.md` files. GitHub keeps the folder structure, so the files land in `design/v2/…`.
4. Check that the file list shows paths starting with `design/v2/`, not `doorway-v2-kit/design/v2/`.
5. Commit message: `Add v2 design kit (Board & Analyst modes)`. Choose **Commit directly to the main branch**, then **Commit changes**.

**From a terminal**
```bash
cd doorway
git checkout main && git pull
unzip ~/Downloads/doorway-v2-kit.zip -d .
git add design/v2 BUILD_PROMPT-v2.md SETUP-v2.md
git commit -m "Add v2 design kit (Board & Analyst modes)"
git push origin main
```

## 2. Start the overnight session

1. Go to claude.ai/code and start a new session.
2. Choose repo **doorway**, branch **main**, and environment **doorway-overnight** (the same one as v1).
3. Pick your strongest model, and set the mode to **Auto**.
4. Paste the whole of `BUILD_PROMPT-v2.md` as the first message and send it.
5. Watch until `STATUS.md` shows **N1** pushed: green baseline and regression snapshot taken. It should take 10–15 minutes. After that you can close the tab.

The session makes its own branch and opens a PR at the end.

## 3. In the morning

1. Open the session and read `STATUS.md` and the PR.
2. Test locally:
   ```bash
   git fetch origin
   git checkout <the PR's branch>
   pnpm install
   pnpm dev
   ```
   Press **V** to switch between the two views.
3. If you're happy with it, merge on GitHub (**Create a merge commit**). Optionally, create a `v2` bookmark the same way you did for v1.

Your credits end Thursday at about 13:30 IST. The prompt tells the session to have everything pushed by 12:30 IST.
