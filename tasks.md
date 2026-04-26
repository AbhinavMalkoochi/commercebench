# Tasks

## What Exists Now

- A standalone research worker lives under `agent/`.
- A basic agent loop can run one research cycle and persist the result.
- A smoke test validates the loop without needing live API access.

## What Needs To Be Built Next

### Runtime Foundation

- Replace the file-backed state store with a real database adapter.
- Add a scheduler wrapper for always-on or cron-based execution.
- Add structured logging and alerting for repeated failures.

### Research Engine

- Broaden the source set with marketplace and community inputs.
- Add richer freshness validation and stronger de-duplication.
- Improve search-backed TikTok extraction with source-citation persistence.
- Add marketing research as a second loop after product selection.

### Integrations

- Add database persistence for heartbeats, decisions, and budget logs.
- Add publishing adapters for Printful, storefront, TikTok Shop, and Pinterest.
- Add metrics adapters for traffic, conversion, and creator uptake.

### Testing

- Add more fixture scenarios for stale trends, regulated products, and weak
  signals.
- Add a live integration test path for source adapters.
- Add regression tests for scoring weights and gate behavior.

### Productization

- Add a dashboard that reads the stored cycle outputs.
- Add a supervisor process for retries, cooldowns, and manual intervention.
- Add later-phase assignments on top of the same worker interfaces rather than
  rewriting the loop.