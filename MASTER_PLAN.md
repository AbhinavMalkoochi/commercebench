# Commercebench Master Plan

## Mission

Build an autonomous commerce agent that can research demand with broad tool access, choose a winning product, create that product through Printful or CJ, list it, set up TikTok affiliate distribution, monitor outcomes, diagnose failures, and pivot without being trapped inside rigid prompt chains.

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
- provider adapters for Printful, CJ, TikTok, and storefront systems
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
- Added a runtime smoke test in `agent/cli/runtime-smoke-test.ts`.
- Added the command `npm run agent:runtime:test`.

### Product Creation Execution Baseline

- Added a Printful draft inspector in `agent/core/printful-draft-inspector.ts`.
- The inspector now turns a Printful draft into concrete catalog and pricing selections using the registered Printful tools.
- Added a smoke test in `agent/cli/printful-draft-inspector-smoke-test.ts`.
- Added the command `npm run agent:product:inspect:test`.

### Budget Control Baseline

- Added a first file-backed budget ledger in `agent/infrastructure/file-budget-ledger.ts`.
- Added a reserve-aware budget service in `agent/core/budget-service.ts`.
- Added a smoke test in `agent/cli/budget-smoke-test.ts`.
- Added the command `npm run agent:budget:test`.

## What We Are Building Next

### Phase 1. Establish The General Tool Runtime

Near-term goal: move from a research-only runtime to a general autonomous execution framework.

Tasks:

1. Expand the tool registry from one tool to a core initial set.
2. Add tool metadata for stage, risk, approval requirements, and runtime policy.
3. Add a tool execution trace so every tool call is stored like research artifacts.
4. Introduce a generic objective or action runner that can call tools outside the research loop.

These baseline tasks are now implemented at the first working level.

### Phase 2. Build Printful-First Product Execution

This is the next business-critical slice.

Tasks:

1. Add a Printful adapter that can inspect catalog items and pricing.
2. Add mockup task creation and polling.
3. Add a product execution result type that records chosen product shell, variants, pricing, and generated assets.
4. Keep publish and payment steps explicitly gated.

The first read-only inspection step is now implemented. Mockup creation, product shell creation, and gated write operations remain next.

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

### Phase 5. Add CJ, Listing, Affiliate Execution, Monitoring, And Pivoting

Tasks:

1. Add CJ sourcing tools and adapters.
2. Add listing-draft and listing-publish stages.
3. Add TikTok affiliate and content execution tools.
4. Add monitoring and diagnosis loops.
5. Add pivot strategies based on performance evidence.

## Immediate Next Tasks

1. Add more hardcoded reusable tools beyond `get_tiktok_affiliate()`, starting with typed fetch, page-read, and provider-read tools.
2. Add more provider tools, starting with additional Printful read tools and the first TikTok affiliate read and setup tools.
3. Add write-path Printful execution in draft mode: mockup task creation, polling, and product shell planning.
4. Connect the budget service to guarded runtime actions.
5. Replace the current single-purpose loop boundary in the main worker with the newer general task-runner model.

## Verification Baseline

These commands should stay green while the architecture evolves:

- `npm run typecheck`
- `npm run agent:research:test`
- `npm run agent:tools:test`
- `npm run agent:runtime:test`
- `npm run agent:budget:test`
- `npm run agent:product:test`
- `npm run agent:product:inspect:test`

## Working Rules

- Use hardcoded reusable functions for tools.
- Prefer typed tool interfaces over prompt-only instructions.
- Keep shell access sandboxed and policy-controlled.
- Avoid reintroducing large heuristic systems for business logic.
- Preserve the traceability of every major decision and action.