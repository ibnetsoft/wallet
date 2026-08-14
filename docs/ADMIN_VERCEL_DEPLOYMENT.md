# Admin Vercel Deployment Guide

Last updated: 2026-08-14

This document explains how to deploy the admin app safely without sending the build to the wrong Vercel project.

## 1. Target

- App path: `apps/admin`
- Vercel project name: `wallet-gyjp`
- Vercel project id: `prj_fRSuk90RkFQejUoOZW0Ao03u275y`
- Vercel org id: `team_QJSGa0a8xgPhaxMYZZGQqISB`
- Production domains:
  - `admin.hongbou.com`
  - `wallet-gyjp.vercel.app`

## 2. Important Repository Links

- Repo root Vercel link: [`.vercel/project.json`](/D:/Projects/wallet/.vercel/project.json:1)
  - This points to the user app project `wallet`.
- Admin Vercel link: [`apps/admin/.vercel/project.json`](/D:/Projects/wallet/apps/admin/.vercel/project.json:1)
  - This points to the admin project `wallet-gyjp`.

## 3. Verified Project Settings

As of 2026-08-14, `wallet-gyjp` is configured like this:

- Root Directory: `apps/admin`
- Framework: Next.js
- Build command: `npm run build`

Because the Root Directory is already `apps/admin`, the deploy command must be run from the repository root when targeting this project manually.

## 4. Safe Production Deploy Command

Run this from `D:\Projects\wallet`.

```powershell
$env:VERCEL_PROJECT_ID='prj_fRSuk90RkFQejUoOZW0Ao03u275y'
$env:VERCEL_ORG_ID='team_QJSGa0a8xgPhaxMYZZGQqISB'
vercel --prod --yes
```

Expected result:

- Production deploy is created for `wallet-gyjp`
- Alias is assigned to `admin.hongbou.com`

## 5. Safe Preview Deploy Flow

- Push a branch to GitHub.
- Vercel creates a Preview deploy automatically for that branch.
- The Preview alias looks like:
  - `wallet-gyjp-git-<branch-name>-389game.vercel.app`

This does not update `admin.hongbou.com`.

## 6. Build Verification Before Deploy

Run this before manual production deploy:

```powershell
Set-Location D:\Projects\wallet\apps\admin
npx eslint src/app/users/page.tsx src/app/api/users/route.ts
npm run build
```

Adjust the ESLint file list to match the files changed in the current task.

## 7. Known Failure Modes

### A. Running deploy from `apps/admin`

Problem:

- Vercel project Root Directory is already `apps/admin`.
- If the command is run inside `apps/admin`, Vercel resolves the deploy input incorrectly and can fail with:
  - `The specified Root Directory "apps/admin" does not exist.`

Fix:

- Run the deploy from repository root `D:\Projects\wallet`.

### B. Running deploy from repo root without targeting the admin project

Problem:

- The repo root [`.vercel/project.json`](/D:/Projects/wallet/.vercel/project.json:1) points to the user app project `wallet`.
- A plain `vercel --prod --yes` from repo root can deploy the user app instead of the admin app.

Fix:

- Set `VERCEL_PROJECT_ID` and `VERCEL_ORG_ID` for `wallet-gyjp` before deploying.

### C. Preview deploy exists but production site still looks old

Problem:

- Branch pushes create Preview deploys only.
- `admin.hongbou.com` continues serving the last Production deploy.

Fix:

- Promote a Production deploy with the safe production command above.

## 8. Do Not Commit These Files

Never commit these directories:

- `.vercel-cli-cache/`
- `.vercel-cli-home/`
- any `.vercel` folder containing local machine link metadata unless intentionally required

Reason:

- `.vercel-cli-home/auth.json` may contain local authentication state.

## 9. Quick Checklist

Before deploy:

- Confirm you are in `D:\Projects\wallet`
- Confirm the target is admin, not user-web
- Run `npm run build` in `apps/admin`
- Set `VERCEL_PROJECT_ID` and `VERCEL_ORG_ID` for `wallet-gyjp`

After deploy:

- Open `admin.hongbou.com`
- Hard refresh with `Ctrl+F5`
- Verify the expected page change is visible

