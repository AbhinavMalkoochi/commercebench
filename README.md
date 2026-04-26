# Commercebench

This repo now contains the first working slice of the commerce agent: a basic
agent loop plus a research loop that can be smoke-tested locally and extended
later with real database, publishing, and analytics adapters.

The current architecture baseline, progress log, and next-task roadmap live in
`MASTER_PLAN.md`.

## Current Scope

- Next.js app remains in place for future dashboard work.
- Standalone TypeScript worker code lives under `agent/`.
- The worker currently focuses on research only.
- State is persisted through a file-backed store for local testing.
- The storage interface is intentionally abstract so a real DB adapter can be
	added later without rewriting the loop.

## Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm run agent:research:test
npm run agent:research:live
```

## Live Research Requirements

`npm run agent:research:live` expects `OPENAI_API_KEY` in the environment.

The live runner uses:

- direct-fetch adapters for Shopify, CJ Dropshipping, and Pinterest
- search-backed extraction for TikTok trend surfaces
- OpenAI Responses for structured search extraction and candidate selection

## Design Notes

- The worker is backend-agnostic. It can run on a cheap VM, container, or cron
	process without depending on Next.js request lifecycle.
- The research loop enforces a minimum of eight planned queries.
- Candidate selection uses deterministic gates first, then weighted scoring,
	then an optional OpenAI reasoner for tie-breaking and narrative output.
- Auth-only surfaces like TikTok Seller Product Opportunities are intentionally
	left out of this first loop.
