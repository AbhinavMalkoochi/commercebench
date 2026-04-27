# Commercebench Final Task Plan

## Goal State

Run the agent 24/7 on a backend server so it can:

- research current TikTok demand continuously
- pick a product backed by recent evidence
- find a matching CJ Dropshipping product
- create a TikTok Shop listing
- connect real fulfillment inputs so CJ can fulfill paid orders
- observe order, listing, and runtime issues
- pivot by deactivating or replacing weak products
- support affiliate discovery and creator outreach workflows

## Completed

- [x] Research loop with trace artifacts and LLM reasoner
- [x] CJ product resolution from research-backed candidate drafts
- [x] Local listing draft generation
- [x] TikTok live product listing creation from runtime artifacts
- [x] Runtime wiring for live TikTok publish when publish credentials are configured
- [x] Dashboard visibility for live listing publish outcomes
- [x] TikTok auth, shop lookup, product search, and order search
- [x] TikTok webhook ingest for order-status payloads
- [x] CJ unpaid supplier-order draft creation
- [x] CJ order list and order detail reconciliation
- [x] Hosted daemon, dashboard, Docker baseline, and remote shell tool
- [x] TikTok-to-CJ order sync baseline
- [x] Standalone CLI env loading from the project `.env`
- [x] Current-month freshness override for month-stamped supplier roundups
- [x] Candidate key normalization for slash-separated label variants
- [x] Configurable live-source timeout for slower search-backed sources
- [x] Live CLI progress logging so long research runs no longer look stuck
- [x] Operator guide for production setup, credentials, and deployment handoff
- [x] Persistent product mapping store between research candidate, TikTok product, and CJ SKU
- [x] Dashboard visibility for persistent product mappings
- [x] TikTok product deactivation and delete flows for pivots
- [x] Product/category compliance hard-blocks for restricted or risky categories

## In Progress

- [ ] Research signal normalization so real overlaps clear the two-source gate more often in live runs
- [ ] Live research consistency hardening after the latest real run passed with `portable-blender`
- [ ] Live TikTok publish validation against real seller credentials
- [ ] Hosted daemon deployment with production secrets and 24/7 supervision

## Remaining Build Tasks

- [ ] Warehouse and delivery-option aware fulfillment configuration per shop
- [ ] Creator-affiliate activation workflow beyond discovery-only scraping
- [ ] Monitoring rules for low views, low CTR, low CVR, and refund / cancellation spikes
- [ ] Automated pivot logic to replace weak listings safely
- [ ] CJ logistics and webhook ingestion for shipment-status updates
- [ ] TikTok listing edits for pricing / title / image iteration
- [ ] Promotion and offer tooling when the selling account is ready

## Manual Setup Still Required

- [ ] Real production secrets injected into the daemon environment
- [ ] Public HTTPS host for dashboard and webhook routes
- [ ] TikTok Shop Partner Center app creation and scope approval
- [ ] TikTok seller authorization for the app
- [ ] CJ API key generation and store authorization
- [ ] Warehouse, logistics, tax, payout, and return settings in TikTok Shop / CJ
- [ ] Manual review of category-specific compliance requirements before enabling live publish

Operator handoff: see `setup.md` for the deployment and credential checklist.

## Deployment Gate

The system should only be treated as end-to-end autopilot-ready once these are true:

- [x] live research runner reads project `.env` and executes with real OpenAI credentials
- [~] live research can clear the two-source gate on real data without timing out
- [ ] live TikTok listing publish succeeds from the runtime
- [ ] a real TikTok order produces an unpaid CJ draft automatically
- [ ] CJ fulfillment and tracking can be reconciled back into runtime state
- [ ] deactivation / pivot flows work on a live listing
- [ ] monitoring can detect poor performance and record a pivot recommendation