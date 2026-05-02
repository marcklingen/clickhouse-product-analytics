# Attribution

This project was implemented independently, but its browser SDK, React integration,
ingest API, identity linking, and ClickHouse schema were informed by public
PostHog projects.

For distribution-oriented license notices, see [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).

## Sources Reviewed

- `posthog-js`: browser SDK queuing, persistence, session handling, autocapture,
  React provider/hook ergonomics, and unload behavior.
  <https://github.com/PostHog/posthog-js>
- `posthog`: event, person, distinct ID, and session schema patterns for
  ClickHouse-backed product analytics.
  <https://github.com/PostHog/posthog>

## License Notes

This repository does not vendor those projects wholesale. Because parts of the
SDK behavior and schema model intentionally stay close to established open source
patterns, this repo preserves conservative third-party notices for distribution.
At the time of review:

- The browser package in `posthog-js` is distributed under the Apache License
  2.0 notice in its repository license, including copyright notices for
  Posthog / Hiberly, Inc. and Mixpanel, Inc.
  <https://github.com/PostHog/posthog-js/blob/main/LICENSE>
- The React package in `posthog-js` is distributed under the MIT License.
  <https://github.com/PostHog/posthog-js/blob/main/packages/react/LICENSE>
- The `posthog` backend repository is distributed under the MIT Expat license
  outside its `ee/` directory. No `ee/` source was used for this project.
  <https://github.com/PostHog/posthog/blob/master/LICENSE>

This file is an attribution and license-compliance aid, not legal advice.
