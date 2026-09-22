# Milestone 9 — Standalone demo

[Tracking issue #15](https://github.com/obaonikoyi/taxprep-au/issues/15)

## Published demo

**[Open TaxPrep AU](https://xobapaycheck.com)**

Since 22 September 2026 the demo answers at `xobapaycheck.com`, its own domain rather than a subdomain of the owner's artist name: a tool people trust with pay documents should not be addressed at a stage name. `taxprep.3xoba.com` stays attached to the same Railway service, so older links keep working. The Railway address `taxprep-au-production.up.railway.app` still serves both and stays recorded in [`deployment.json`](../deployment.json) as the origin behind them.

First published on 18 September 2026 from commit `e9e5fac6d469ee117b9796eaf306723401fecf61`, Railway deployment `87ca38d9-c44f-46fa-a3b3-2b5aa23af8fb`. The service tracks `main`; later commits may redeploy. Hosting identifiers and the public address are recorded in [`deployment.json`](../deployment.json), without credentials.

The [production build verification](https://github.com/obaonikoyi/taxprep-au/actions/runs/35322971382) passed all three jobs: frontend, backend and production container. The [hosted verification workflow](https://github.com/obaonikoyi/taxprep-au/actions/workflows/verify-hosted.yml) runs the same visitor journey against the actual public address whenever `deployment.json` changes, and can also be run manually. Its artifact contains screenshots, the downloaded sample report and JSON results. Obadiah's portfolio website itself remains unchanged; the app has its own address under his domain rather than a page on that site.

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
- Generate a Railway service domain after deployment. The app also answers at `xobapaycheck.com` and at `taxprep.3xoba.com`, both custom domains on the same service, proxied through Cloudflare; the portfolio website itself is still a separate thing and is not served from this project.
- Keep the public URL and initial release record in this document and `deployment.json`; inspect Railway for the latest deployed commit.
- Railway hosting uses the owner's existing account and its usage billing; this setup does not add a database or paid third-party service.
- Inspect Railway build/runtime logs if a deployment fails. To roll back, use Railway's previous successful deployment or revert the relevant GitHub commit and redeploy.
- Same-browser progress belongs to the exact origin, so each move has left the previous address's saved progress behind — the Railway address when the demo moved to `taxprep.3xoba.com`, and that subdomain in turn when it moved to `xobapaycheck.com`. The light/dark choice is stored the same way and starts again from the device preference on the new address. Moving to a different domain does not transfer saved copies. Restart/delete removes the local snapshot; the server has no copy to recover.
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

After this release, Obadiah clarified that the goal is document-led tax preparation, including supported deduction assessment and eventual return preparation. The [updated product direction](PRODUCT_DIRECTION.md) replaces the checklist-only follow-up with [Milestone 10: document intake and evidence matching](https://github.com/obaonikoyi/taxprep-au/issues/18). Real financial-data use still needs a deliberate handling policy and an appropriate service model. The owner makes the final portfolio decision; publication of this demo does not make that decision for him.
