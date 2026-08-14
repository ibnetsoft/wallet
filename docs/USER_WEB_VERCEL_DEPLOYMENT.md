# User Web Vercel Deployment Guide

Last updated: 2026-08-14

This document explains how to deploy the user-facing web app safely and how it differs from the admin deployment flow.

## 1. Target

- App path: `apps/user-web`
- Vercel project name: `wallet`
- Vercel project id: `prj_i9F0FDmmT8Am1ebrFqmBGYtySaRB`
- Vercel org id: `team_QJSGa0a8xgPhaxMYZZGQqISB`
- Production domains:
  - `www.hongbou.com`

## 2. Important Repository Links

- Repo root Vercel link: [`.vercel/project.json`](/D:/Projects/wallet/.vercel/project.json:1)
  - This points to the user app project `wallet`.
- User app Vercel link: [`apps/user-web/.vercel/project.json`](/D:/Projects/wallet/apps/user-web/.vercel/project.json:1)
  - This also points to `wallet`.

## 3. Verified Project Settings

The root project linked at repository level is the user app project.

That means a plain production deploy from repo root targets the user app unless the project target is overridden manually.

## 4. Safe Production Deploy Command

Run this from `D:\Projects\wallet`.

```powershell
$env:VERCEL_PROJECT_ID='prj_i9F0FDmmT8Am1ebrFqmBGYtySaRB'
$env:VERCEL_ORG_ID='team_QJSGa0a8xgPhaxMYZZGQqISB'
vercel --prod --yes
```

This is the safest pattern because it makes the target explicit.

## 5. Safe Preview Deploy Flow

- Push a branch to GitHub.
- Vercel creates a Preview deploy for the user app if the connected Git integration is active for that branch.
- Preview deploys do not replace `www.hongbou.com`.

## 6. Build Verification Before Deploy

Run this before manual production deploy:

```powershell
Set-Location D:\Projects\wallet\apps\user-web
npm run build
```

Add lint or route-specific checks when the task changes behavior in sensitive flows such as login, register, balance, package purchase, or withdrawal.

## 7. Admin vs User Deploy Difference

This repo has two separate Vercel projects:

- `wallet` for `apps/user-web`
- `wallet-gyjp` for `apps/admin`

The default repo-root link points to `wallet`.

Therefore:

- `vercel --prod --yes` from repo root deploys the user app by default.
- Admin deploys must explicitly override the target project.

## 8. Known Failure Modes

### A. Accidentally deploying the user app while trying to update admin

Problem:

- Running `vercel --prod --yes` from repo root without overriding the project will deploy `wallet`.

Symptom:

- `www.hongbou.com` updates
- `admin.hongbou.com` stays unchanged

Fix:

- Use the admin project ids from [ADMIN_VERCEL_DEPLOYMENT.md](/D:/Projects/wallet/docs/ADMIN_VERCEL_DEPLOYMENT.md:1)

### B. Production looks stale after branch push

Problem:

- Git branch pushes usually create Preview deploys first.

Fix:

- Trigger a Production deploy explicitly for the intended project.

## 9. Do Not Commit These Files

Never commit:

- `.vercel-cli-cache/`
- `.vercel-cli-home/`

Reason:

- These are local CLI cache and auth artifacts, not deploy source.

## 10. Quick Checklist

Before deploy:

- Confirm the target app is `apps/user-web`
- Confirm you are not trying to update admin
- Run `npm run build` in `apps/user-web`
- Set the `wallet` project id and org id explicitly

After deploy:

- Open `www.hongbou.com`
- Hard refresh with `Ctrl+F5`
- Verify the expected page change is visible
