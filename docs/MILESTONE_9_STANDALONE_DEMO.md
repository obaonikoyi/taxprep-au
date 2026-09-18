# Milestone 9 — Standalone demo

[Tracking issue #15](https://github.com/obaonikoyi/taxprep-au/issues/15)

## Purpose

Give someone a link they can open and try without installing the project. Obadiah's portfolio website and custom domains stay unchanged until he decides this is useful enough to showcase.

The present product is a fictional-data expense preparation demo. It organises three expense categories and identifies missing information. It does not determine tax eligibility, estimate a refund or lodge a return.

## One useful visitor task

1. Open the standalone demo and expand **Try one useful task: a phone expense**.
2. Choose **Try sample CSV** in the transaction section.
3. Select **Sunrise Mobile Services**, choose **Phone service** and review the selection.
4. Enter 40% work use, Not reimbursed and Evidence missing. Save the expense.
5. Inspect the $18 work portion (40% of $45), missing-evidence checklist and original transaction reference.
6. Download the HTML preparation report. Save progress, reload, and resume if desired.

This demonstrates a complete input → review → output task. The $18 is an organising calculation, not an approved deduction.

## Production architecture

A root Dockerfile builds React using Node 22 and the committed npm lockfile, publishes the .NET 8 API, and copies the built frontend into its `wwwroot`. The runtime image runs as its non-root `app` user. Node and the .NET SDK are build dependencies, not runtime services.

ASP.NET Core serves `/` and built assets alongside `/api/health`, `/api/transactions/import-preview` and `/api/expenses/review`. Unknown API routes return 404. There is no Vite server, CORS configuration, database or separate frontend service in production.

Railway provides public HTTPS. The container binds `0.0.0.0` on Railway's `PORT` (8080 when running locally). `Hosting__HttpsHandledByProxy=true` explicitly disables the application's HTTPS redirect for the private HTTP hop and healthchecks. Other non-development hosts retain HTTPS redirection unless they opt into that setting. Do not expose this HTTP container directly to the public internet without a TLS proxy.

The Railway configuration specifies Dockerfile builds, `/api/health` as the deployment healthcheck and at most three restarts on failure. A healthy API alone does not prove the UI works; the production and hosted browser tests also load the built page, use its API and download a report.

Official references: [Railway Dockerfiles](https://docs.railway.com/builds/dockerfiles), [healthchecks](https://docs.railway.com/deployments/healthchecks), [configuration](https://docs.railway.com/config-as-code/reference).

## Deploy and operate

- Create a separate Railway project/service from `obaonikoyi/taxprep-au`, branch `main`, with the repository root as the build context.
- The root `Dockerfile` and `railway.json` configure the build and healthcheck. No application secrets or database variables are required.
- Generate a Railway service domain after deployment. Do not attach the portfolio domain.
- Record the actual URL and successful deployed commit in this document after verification.
- Railway hosting uses the owner's existing account and its usage billing; this setup does not add a database or paid third-party service.
- Inspect Railway build/runtime logs if a deployment fails. To roll back, use Railway's previous successful deployment or revert the relevant GitHub commit and redeploy.
- Same-browser progress belongs to the exact origin. Moving to a different domain does not transfer saved copies. Restart/delete removes the local snapshot; the server has no copy to recover.
- Request processing remains in memory with existing validation and upload limits. Use fictional data; do not collect TFNs, identity documents or financial account credentials. Platform request metadata may still appear in hosting logs.

## Verify

```bash
docker build -t taxprep-demo .
docker run --rm -p 8080:8080 taxprep-demo
# In another terminal:
cd src/frontend
npm ci
npx playwright install --with-deps chromium
npm run test:hosted
```

For an already-running deployment, set `DEMO_URL` to its HTTPS address and run `npm run test:hosted`. The GitHub **Verify hosted demo** workflow accepts the standalone Railway address and executes the same test with fictional data in a fresh browser context.

Build CI additionally tests the real container with an overridden `PORT=9090`, exercising the production environment and static files. Existing frontend/API tests and development browser regressions remain in place. Screenshots and JSON evidence have seven-day retention in Actions.

## Usefulness decision

**Ready for:** trying the sample journey, demonstrating CSV validation, editable work-use calculations, evidence tracking, local progress recovery and report export.

**Not yet claimed ready for:** a person's real tax preparation. The app is still fixed to Sarah's fictional profile and three categories; it has no reviewed deduction guidance, complete return coverage or real-data operating policy.

Before adding this to Obadiah's website as a useful tax-preparation product, the next milestone should let a visitor prepare their own bounded expense checklist with neutral wording instead of Sarah, explain supported inputs clearly, and test the task with a few people. Real financial-data use needs a deliberate handling policy and review of what the app promises. The owner makes the final portfolio decision; publication of this demo does not make that decision for him.
