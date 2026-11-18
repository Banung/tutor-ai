# Development deployment on Google Cloud

Project: `tutor-ai-514808`. Region: `asia-southeast1`.

## Web

Cloud Run service: `tutor-ai-dev`. Docker target: `web`.
The image uses Next.js standalone output, port 8080, and a non-root user.
Secrets are runtime environment variables, never Docker build arguments.
Minimum instances: 0. Maximum instances: 2.

## Material processing

Cloud Run job: `tutor-material-worker-dev`. Docker target: `worker`.
The container processes at most one queued material and exits. It uses the
same PostgreSQL and Supabase storage as the web application.
Start with 1 CPU, 2 GiB RAM, one task, a 30-minute timeout, and no retries.
A failed material is marked by the application; platform retries do not
necessarily retry that same material. Interrupted work becomes eligible
for recovery after the existing two-hour database lease expires.

Manual execution:

```sh
gcloud run jobs execute tutor-material-worker-dev --project=tutor-ai-514808 --region=asia-southeast1 --wait
```

Scheduled executions can overlap. Database row locking reserves separate
materials, but each execution processes only one material. Do not shorten
the lease below the longest possible execution time.

## GitHub Actions

`.github/workflows/deploy-gcp.yml` builds both images and deploys on a push
to `development`, or a manual workflow dispatch. OIDC authentication is
restricted to `Banung/tutor-ai` and `refs/heads/development`.

Repository variables:

- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_DEPLOY_SERVICE_ACCOUNT`

Repository secret:

- `TUTOR_RUNTIME_ENV_JSON`: JSON object containing runtime environment
  variables. Use remote database credentials and the deployed web URL for
  `BETTER_AUTH_URL`. Never commit this JSON file. No Secret Manager is used.

The worker receives only database, Supabase, and Gemini configuration.
Deployment does not execute database migrations automatically. Apply and
verify migrations against the intended database before releasing schema changes.

The workflow must be pushed to GitHub before automatic deployments can run.
Cloud Run compute, registry storage, logs, networking, and external APIs
have separate quotas and charges. Budget alerts are notifications, not caps.
