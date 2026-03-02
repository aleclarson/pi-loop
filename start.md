This is a fantastic repository pattern. Using a monorepo (`goddard`) with `pnpm workspaces` gives my team the ultimate developer experience (local linking, unified linting/testing, single PRs for cross-cutting changes). Meanwhile, `git-subrepo` ensures our open-source consumers get clean, isolated, standalone repositories (`sdk`, `cmd`, etc.) without the noise of the rest of our monorepo.

To automate this, we need a GitHub Action that runs every time code is merged into the `main` branch of `goddard`. It will isolate the commits for each directory and push them to their respective repositories.

Here is how to set up the GitHub Action to automate `git-subrepo`.

### 1. Prerequisites (Authentication)
The default `GITHUB_TOKEN` provided by Actions can only write to the repository it runs in (`goddard`). It **cannot** push to the external standalone repositories.

You must create a **Personal Access Token (PAT)** (either a Fine-Grained token with Read/Write code access to all 5 repositories, or a Classic Token with the `repo` scope).
* Go to your `goddard` repository settings -> Secrets and Variables -> Actions.
* Add the token as a repository secret named `SYNC_PAT`.

### 2. The GitHub Action Workflow

Create this file in your monorepo at `.github/workflows/sync-subrepos.yml`.

```yaml
name: Sync Subrepos

on:
  push:
    branches:
      - main
    # Optional: Only trigger this action if files in the subrepos actually changed
    paths:
      - 'backend/**'
      - 'cmd/**'
      - 'github-app/**'
      - 'sdk/**'

# Ensure only one sync runs at a time to prevent git conflicts on the .gitrepo files
concurrency:
  group: sync-subrepos
  cancel-in-progress: false

jobs:
  sync:
    name: git-subrepo push
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Monorepo
        uses: actions/checkout@v4
        with:
          # REQUIRED: git-subrepo needs the full git history to calculate splits
          fetch-depth: 0
          # Use the PAT so we have permissions to push back to goddard AND out to the subrepos
          token: ${{ secrets.SYNC_PAT }}

      - name: Setup Git Identity
        run: |
          git config --global user.name "github-actions[bot]"
          git config --global user.email "github-actions[bot]@users.noreply.github.com"

          # Inject the PAT into Git so git-subrepo can push to the external HTTPS URLs
          git config --global url."https://${{ secrets.SYNC_PAT }}@github.com/".insteadOf "https://github.com/"

      - name: Install git-subrepo
        run: |
          git clone https://github.com/ingydotnet/git-subrepo.git ~/.git-subrepo
          echo "GIT_SUBREPO_ROOT=$HOME/.git-subrepo" >> $GITHUB_ENV
          echo "$HOME/.git-subrepo/lib" >> $GITHUB_PATH

      - name: Push subrepos
        run: |
          # The '|| true' ensures that if one subrepo has no changes, it doesn't fail the whole job
          git subrepo push backend || true
          git subrepo push cmd || true
          git subrepo push github-app || true
          git subrepo push sdk || true

      - name: Push .gitrepo updates to Monorepo
        run: |
          # When git-subrepo pushes to an external repo, it updates the local .gitrepo file
          # with the new commit hash, and commits that change locally.
          # We must push these state updates back to the main branch of the monorepo.

          git push origin main
```

### 3. Crucial "Gotchas" to keep in mind:

1. **`fetch-depth: 0` is mandatory**: `git-subrepo` works by walking back through the tree and finding the common ancestor to split off branch histories. If GitHub Actions does its default "shallow clone" (depth of 1), `git-subrepo` will fail spectacularly.
2. **Infinite Loops**: When step 5 (`git push origin main`) pushes the updated `.gitrepo` files back to `goddard`, you might worry it will trigger this Action again in an infinite loop. **It won't.** GitHub Actions intentionally prevents commits created by a workflow using a PAT/Bot from triggering subsequent `push` workflows, inherently protecting you from loops.
3. **The `.gitrepo` remote URL**: Ensure your `.gitrepo` files inside each directory are tracking the `https://` URLs for the external repos (e.g., `https://github.com/your-org/sdk.git`). If they are using SSH (`git@github.com:...`), the step that injects the `SYNC_PAT` won't work, and you would need to use `webfactory/ssh-agent` with SSH Deploy keys instead.

### 4. Working with pnpm
Your `pnpm-workspace.yaml` will sit at the root of `goddard`.
```yaml
packages:
  - 'backend'
  - 'cmd'
  - 'github-app'
  - 'sdk'
```
Because of `git-subrepo`, the `sdk` repo will have no idea it is part of a workspace when someone clones it independently. This is a *good* thing.

**To ensure this works cleanly:**
* Any dependencies the `cmd`, `backend`, or `github-app` have on the `sdk` should be defined in their `package.json` using standard versions (e.g., `"@goddard-ai/sdk": "workspace:*"`).
* When you publish to NPM (or release via CI), `pnpm` will automatically replace `workspace:*` with the actual version number for the consumers of your standalone repos.
* Standalone consumers who clone `https://github.com/your-org/cmd` won't need `pnpm` workspace features because they are just building that specific isolated package.
