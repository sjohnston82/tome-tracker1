# Password-reset email

Production requires three server settings:

- `RESEND_API_KEY`: a Resend sending API key, stored as a production secret.
- `RESEND_FROM_EMAIL`: a bare email address on the exact domain verified in Resend, such as `noreply@mail.example.com`.
- `NEXT_PUBLIC_APP_URL`: the canonical HTTPS app origin, such as `https://tome-tracker1.vercel.app`. Do not add a path, query, or credentials.

Create the Resend account at https://resend.com/signup, verify a domain at https://resend.com/domains by publishing the supplied DNS records, then create the sending key at https://resend.com/api-keys. Enter the key directly in Vercel's project environment settings; never commit it or paste it into chat. Redeploy after changing these settings.

Resend's `onboarding@resend.dev` address is restricted to the email address associated with the Resend account. It can test personal recovery, but cannot support arbitrary users. A normal sender requires a domain you control. See https://resend.com/docs/knowledge-base/403-error-resend-dev-domain and https://resend.com/docs/send-with-nodejs.

## Behavior and verification

Missing or invalid global configuration returns `503 EMAIL_UNAVAILABLE` before account lookup, so the form can display an honest setup error without disclosing account existence. Configured requests use the same generic response for existing and unknown accounts. The response says an email was requested, rather than promising delivery. Provider rejection is logged without recipients, keys, or reset links; an undelivered token is deleted, while previous links remain usable. Provider acceptance does not guarantee inbox delivery: inspect the message status in Resend and check the recipient's spam folder.

Reset requests have a best-effort per-email limiter (five per hour per server instance). This in-memory limit does not provide a shared quota across Vercel instances. Single-use consumption is enforced by a serializable database transaction. The password changes and all the account's reset links are invalidated together. Concurrent uses of one link allow only one successful reset. No library records are modified.

After configuring production, request a link for your own account and check its delivery status in Resend. Open the link, choose a password, confirm sign-in, and confirm reuse is rejected. Do not put working links in issue descriptions or logs. Automated tests mock the provider and use a disposable localhost database; they do not prove real delivery.

## Verification for this change

- Email/configuration/request tests cover missing configuration, provider error results and exceptions, safe logging, generic account responses, and preservation of older links.
- Database tests cover expiry, password validation, isolation from another account, replay, and simultaneous token consumption.
- Run database files sequentially against a disposable database (`--no-file-parallelism`); explicit concurrency tests still run inside those files.
