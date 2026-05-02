# Security

This project accepts browser-originated events from configured origins. `PUBLIC_API_KEYS` is optional to configure; when configured, keys are required for backend or no-origin requests and optional for allowed-origin browser requests. Treat browser-exposed keys as routing and abuse-control credentials, not as secrets.

## Supported Versions

The project is pre-1.0. Security fixes are applied to the latest `main` branch until versioned releases exist.

## Reporting

Open a private security advisory in GitHub if the repository is hosted there, or contact the maintainer directly before publishing exploit details.

## Operational Guidance

- Restrict browser traffic with `ALLOWED_ORIGINS`.
- Use long random values for `PUBLIC_API_KEYS` when backend or no-origin requests are enabled, keep old and new values configured during key rotation, and leave the list empty to disable no-origin backend ingest.
- Do not send passwords, tokens, payment data, or private free-form text in event properties.
- Run the ingest service behind HTTPS in production.
- Run migrations explicitly before production deploys.
