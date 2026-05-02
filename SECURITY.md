# Security

This project accepts browser-originated events with publishable API keys. Treat those keys as routing and abuse-control credentials, not as secrets.

## Supported Versions

The project is pre-1.0. Security fixes are applied to the latest `main` branch until versioned releases exist.

## Reporting

Open a private security advisory in GitHub if the repository is hosted there, or contact the maintainer directly before publishing exploit details.

## Operational Guidance

- Restrict browser traffic with `ALLOWED_ORIGINS`.
- Use long random values for `PUBLIC_API_KEYS`.
- Do not send passwords, tokens, payment data, or private free-form text in event properties.
- Run the ingest service behind HTTPS in production.
- Run migrations explicitly before production deploys.
