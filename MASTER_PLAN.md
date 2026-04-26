# Commercebench Master Plan

## Mission

Build an autonomous commerce agent that can research demand with broad tool access, choose a winning product, source that product through CJ Dropshipping, list it on TikTok Shop, activate TikTok affiliate distribution, monitor outcomes, diagnose failures, and pivot without being trapped inside rigid prompt chains.

The system should feel like a real agent with broad capabilities, but it should run inside a strong control plane. The model should be free to plan, investigate, and adapt. The runtime should own safety, budget enforcement, approvals for irreversible actions, action logging, and recovery.

## Core Principles

- Treat the model as a planner and operator, not just a text generator.
- Prefer broad tool access over source-specific hardcoded heuristics.
- Keep deterministic rules thin and explicit: safety, budget, compliance, freshness, and irreversible actions.
- Make every important action traceable and reconstructible after the fact.
- Start with high autonomy for research and diagnostics, then expand toward execution as the runtime proves reliable.

## Target Architecture

### 1. Objective-Driven Agent Loop

The runtime should move from a single-purpose research loop to a multi-stage objective runner.

The agent should be able to move across these stages:

- research
- validation
- product creation
- listing
- affiliate setup
- content generation
- monitoring
- diagnosis
- pivoting

The model should be allowed to revisit earlier stages when evidence changes instead of being forced through a rigid one-way pipeline.

### 2. Tool Plane

The agent should interact with the outside world through hardcoded reusable tools.

The long-term tool surface should include:

- web search
- full-page fetch and extraction
- browser or dynamic-page rendering
- filesystem read and write
- sandboxed shell commands
- typed HTTP requests
- provider adapters for CJ, TikTok, and storefront systems
- budget inspection
- approval inspection
- trace and artifact inspection

Tools should be explicitly named functions with typed inputs and outputs. The model should select from these tools rather than improvising the whole system through unstructured shell commands.

### 3. Control Plane

The runtime should govern execution without taking strategy away from the model.

The control plane should own:

- budget checks
- approval workflows
- action classification
- retry and cooldown rules
- circuit breakers
- secret isolation
- domain and network restrictions for shell or curl access
- durable state
- audit logs and traces

### 4. Execution Classes

The agent should not treat all actions equally.

Fully autonomous actions:

- research
- diagnostics
- note taking
- draft generation
- pricing estimation
- evidence collection
- plan revision

Bounded autonomous actions:

- creating local artifacts
- creating provider drafts
- generating mockup tasks
- preparing listings without publishing
- updating internal state

Guarded actions:

- real supplier orders
- real payments
- publishing listings live
- publishing TikTok content live
- changing externally visible price
- account-level mutations

## Current Baseline

The repository already has a working research-first kernel.

- A standalone worker exists under `agent/`.
- The current research loop can execute, score candidates, and persist local state.
- Research traces are written under `.agent-state/live/traces/`.
- A product-creation kernel exists, but it only produces drafts.
- The current state store is file-backed.

## Progress Completed

### Research Reliability

- Search-backed research quality gating is in place.
- The runtime now rejects stale, weakly cited, or low-substance signals before scoring.
- An audit CLI exists to inspect the latest saved research run.

### Product Creation Baseline

- The kernel can route a winning candidate toward a Printful-first or CJ-first draft.
- Approval requirements are already modeled at the draft level.
- The active roadmap now treats CJ as the only execution provider, with Printful left as dormant reference code until explicitly needed again.

### Tool Runtime Baseline

The first explicit reusable tool slice is now implemented.

- Added a typed tool model in `agent/core/tools.ts`.
- Added a static tool registry in `agent/core/tool-registry.ts`.
- Added a hardcoded `fetch_web_page()` tool in `agent/tools/fetch-web-page.ts`.
- Added a hardcoded `get_tiktok_affiliate()` tool in `agent/tools/get-tiktok-affiliate.ts`.
- Added hardcoded `get_printful_products()` and `get_printful_variant_prices()` tools in `agent/tools/`.
- Added a smoke test in `agent/cli/tool-smoke-test.ts`.
- Added the command `npm run agent:tools:test`.

This is the first step toward a general tool plane where the agent can select named functions instead of relying on brittle prompt-only behavior.

### General Runtime Baseline

- Added a tool policy layer in `agent/core/tool-policy.ts`.
- Added a general stage-aware task runner in `agent/core/task-runner.ts`.
- Added a tool executor that traces tool inputs and outputs in `agent/core/tool-executor.ts`.
- Extended `agent/core/agent-loop.ts` so the main worker can persist post-research product-creation planning instead of stopping at research-only records.
- Added a runtime smoke test in `agent/cli/runtime-smoke-test.ts`.
- Added the command `npm run agent:runtime:test`.

### Product Creation Execution Baseline

- Added a Printful draft inspector in `agent/core/printful-draft-inspector.ts`.
- The inspector now turns a Printful draft into concrete catalog and pricing selections using the registered Printful tools.
- Added a smoke test in `agent/cli/printful-draft-inspector-smoke-test.ts`.
- Added the command `npm run agent:product:inspect:test`.
- Added a first CJ sourcing read tool in `agent/tools/query-cj-products.ts`.
- Added hardcoded `get_cj_access_token()` and `refresh_cj_access_token()` tools in `agent/tools/`.
- Added a CJ draft inspector in `agent/core/cj-draft-inspector.ts`.
- Added a smoke test in `agent/cli/cj-draft-inspector-smoke-test.ts`.
- Added the command `npm run agent:cj:inspect:test`.

### Budget Control Baseline

- Added a first file-backed budget ledger in `agent/infrastructure/file-budget-ledger.ts`.
- Added a reserve-aware budget service in `agent/core/budget-service.ts`.
- Connected the general task runner to optional budget checks for priced steps.
- Added repeated-runtime-failure pause behavior in `agent/core/agent-loop.ts` so the loop can automatically cool down after consecutive hard failures.
- Added a smoke test in `agent/cli/budget-smoke-test.ts`.
- Added a smoke test in `agent/cli/pause-smoke-test.ts`.
- Added the command `npm run agent:budget:test`.
- Added the command `npm run agent:pause:test`.

### Approval And Draft-Mode Execution Baseline

- Added a file-backed approval store in `agent/infrastructure/file-approval-store.ts`.
- Added an approval service in `agent/core/approval-service.ts`.
- Added hardcoded `create_printful_mockup_task()` and `get_printful_mockup_task()` tools in `agent/tools/`.
- Added a hardcoded `create_printful_store_product()` tool in `agent/tools/` for guarded Printful store-product draft creation.
- Registered the new Printful mockup tools in the static registry.
- Added a Printful draft executor in `agent/core/printful-draft-executor.ts` that bridges inspected drafts into mockup-task execution artifacts.
- Extended the Printful draft executor so it can optionally create a guarded store-product draft after mockup generation.
- Added a local listing-draft builder in `agent/core/listing-draft-builder.ts` that turns provider draft artifacts into a non-published listing draft.
- Added a first CJ sourcing read tool in `agent/tools/query-cj-products.ts` and a CJ draft inspector in `agent/core/cj-draft-inspector.ts`.
- Extended the runtime smoke test to verify approval-gated execution for Printful mockup creation.
- Added a smoke test in `agent/cli/approval-smoke-test.ts`.
- Added a smoke test in `agent/cli/printful-draft-executor-smoke-test.ts`.
- Added a smoke test in `agent/cli/listing-draft-smoke-test.ts`.
- Added a smoke test in `agent/cli/cj-draft-inspector-smoke-test.ts`.
- Added the command `npm run agent:approval:test`.
- Added the command `npm run agent:product:execute:test`.

## What We Are Building Next

### Phase 1. Establish The General Tool Runtime

Near-term goal: move from a research-only runtime to a general autonomous execution framework.

Tasks:

1. Expand the tool registry from one tool to a core initial set.
2. Add tool metadata for stage, risk, approval requirements, and runtime policy.
3. Add a tool execution trace so every tool call is stored like research artifacts.
4. Introduce a generic objective or action runner that can call tools outside the research loop.

These baseline tasks are now implemented at the first working level.

### Phase 2. Build CJ-First Product Execution

This is the next business-critical slice.

Tasks:

1. Add CJ authentication, sourcing, and execution primitives.
2. Add a CJ draft executor that can turn a sourced-product draft into provider-backed execution artifacts.
3. Add a product execution result type that records selected CJ products, variants where applicable, pricing, and downstream listing inputs.
4. Keep payment steps explicitly gated and manual-only.

The first CJ sourcing read slice and the first CJ auth/token slice are now implemented. Full CJ execution still remains next.

### Phase 3. Upgrade Research From Fixed Planning To Model-Led Planning

Tasks:

1. Replace the fixed query planner with a research agenda generator.
2. Allow the agent to choose follow-up research based on evidence gaps.
3. Keep only a thin deterministic floor for safety and minimum evidence classes.

### Phase 4. Add Budget, Approvals, And Circuit Breakers

Tasks:

1. Introduce a budget service with hard spending limits.
2. Add approval workflows for irreversible actions.
3. Add repeated-failure detection and automatic pause behavior.

Budget checks, a first file-backed approval workflow, and a first repeated-failure pause mechanism are now implemented.

### Phase 5. Add TikTok Listing, Affiliate Execution, Monitoring, And Pivoting

Tasks:

1. Add TikTok Shop auth, authorized-shop resolution, and listing-draft/listing-publish stages.
2. Add TikTok affiliate execution tools and creator-facing product distribution flows.
3. Add monitoring and diagnosis loops.
4. Add pivot strategies based on performance evidence.

## Immediate Next Tasks

1. Remove Printful from the active execution path and switch the live runner to CJ-only provider handling.
2. Add the next CJ execution tools beyond product query and token handling.
3. Extend the CJ execution slice from sourcing reads into guarded draft creation while keeping payments manual-only.
4. Add TikTok Shop auth, authorized-shop lookup, and provider-backed listing drafts.
5. Add TikTok affiliate execution after listing creation is stable.

## Verification Baseline

These commands should stay green while the architecture evolves:

- `npm run typecheck`
- `npm run agent:research:test`
- `npm run agent:approval:test`
- `npm run agent:tools:test`
- `npm run agent:runtime:test`
- `npm run agent:budget:test`
- `npm run agent:pause:test`
- `npm run agent:product:test`
- `npm run agent:product:inspect:test`
- `npm run agent:product:execute:test`
- `npm run agent:listing:test`
- `npm run agent:cj:inspect:test`

## Working Rules

- Use hardcoded reusable functions for tools.
- Prefer typed tool interfaces over prompt-only instructions.
- Keep shell access sandboxed and policy-controlled.
- Avoid reintroducing large heuristic systems for business logic.
- Treat CJ as the only active execution provider until TikTok Shop listing and affiliate execution are stable.
- Preserve the traceability of every major decision and action.