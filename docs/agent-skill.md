---
title: Coding Agent Skill
description: Use the repo-local skill to add tracking to applications.
---

# Coding Agent Skill

This repository includes a Codex-compatible skill at:

```text
skills/product-analytics-tracking/SKILL.md
```

Use it when asking a coding agent to add product analytics tracking to an application. The skill assumes the npm packages are available and guides the agent to:

- find existing analytics conventions before adding new calls,
- choose and initialize the SDK or React provider,
- add stable event names and privacy-safe properties,
- use `identify`, `$set`, and `$set_once` intentionally,
- update or add tests for the tracked user flow,
- avoid sending secrets, tokens, passwords, or high-cardinality payloads.

Example prompt:

```text
Use the product-analytics-tracking skill and add tracking for signup completion in this app.
```

For exact SDK calls, see [Sending events](./sending-events.md) and the [generated SDK reference](./reference/sdk/README.md). For backend events, see the [HTTP API reference](./reference/http-api.md).
