# Security Policy

BerrelEye handles provider credentials and customer traffic metadata, so
security reports are taken seriously.

## Reporting a vulnerability

Do **not** open a public issue for a security problem. Use GitHub's private
vulnerability reporting on this repository (Security → Report a vulnerability)
or contact the maintainers directly. Include:

- affected component and version/commit
- reproduction steps or a proof of concept
- impact assessment
- any suggested fix

Please allow reasonable time for a fix before public disclosure.

## Deployment hardening

- Set a real `ENCRYPTION_KEY` (32 random bytes, base64). Without it the
  gateway falls back to a development key and marks stored secrets
  `dev_only: true`.
- Set `COOKIE_SECURE=true` when the dashboard is served over HTTPS.
- Never expose Postgres or Redis to the public internet.
- Keep provider API keys server-side only; never put them in
  `NEXT_PUBLIC_*` variables.
- Rotate provider keys and gateway API keys if a host is compromised.
- Run the published images with a pinned version tag rather than `latest`
  in production.
