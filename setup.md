# Operator Guide

This is the manual handoff for moving Commercebench from the current repo state to a real hosted operator environment.

## Current State

- Research, CJ sourcing, local listing drafts, TikTok listing publish tooling, order sync, dashboard, and hosted daemon entrypoints are implemented.
- The live runner now loads the project environment and prints per-query progress so long runs no longer look stalled.
- Stable regression checks are green.
- The remaining runtime blocker is live data convergence: real sources can still return disjoint product clusters, so some live runs end as `blocked_low_signal`.

## Manual Setup Checklist

### 1. CJ Dropshipping

- Create or log into the CJ account that will fulfill TikTok orders.
- Open the CJ developer or API area and generate an API key.
- Set that key as `CJ_API_KEY` in the hosted runtime.
- Connect the selling store inside CJ through the authorization or store-management area.
- If CJ exposes TikTok Shop as a native channel in your account, authorize that seller account.
- Copy the exact connected store name into `CJ_STORE_NAME` if you want the runtime to target a specific store.
- Pick the default logistics line. If you do not override it, the runtime uses `CJPacket Ordinary`.
- Pick the origin country code. If you do not override it, the runtime uses `CN`.
- Keep supplier payment manual. The current automation only creates unpaid CJ drafts.

### 2. TikTok Shop Seller Center

- Complete seller verification.
- Add warehouse and return addresses.
- Finish shipping, tax, and payout setup.
- Confirm the selling account is active in the target market.
- Make sure the account used for app authorization is a seller admin.

### 3. TikTok Shop Partner Center

- Create the partner app that the runtime will use.
- Add the OAuth redirect URL and webhook URL.
- Request the scopes needed for shop authorization, product read, product write, order read, and webhook delivery.
- Authorize the app against the target seller account.
- Exchange the auth code for tokens.
- Store the authorized shop cipher.

### 4. Webhooks

- Deploy the Next.js app to a public HTTPS domain.
- Register the order-status webhook at:

```text
https://your-domain.com/api/webhooks/tiktok/order-status
```

- Trigger a webhook test from Partner Center if available.
- Confirm webhook artifacts are written on the server.

### 5. Hosted Runtime

- Run the dashboard and daemon on a server with persistent storage for `.agent-state`.
- Inject environment variables into the process manager or container runtime itself.
- Do not rely on a local unchecked `.env` file sitting beside the code.
- Confirm the daemon process can see the same secrets the dashboard uses.

## Minimum Environment Variables

```dotenv
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.4
EXA_API_KEY=...

CJ_API_KEY=...
CJ_ORDER_SYNC_ACCESS_TOKEN=...
CJ_DEFAULT_LOGISTIC_NAME=CJPacket Ordinary
CJ_FROM_COUNTRY_CODE=CN
CJ_STORE_NAME=...

TIKTOK_APP_KEY=...
TIKTOK_APP_SECRET=...
TIKTOK_SHOP_CIPHER=...
TIKTOK_ORDER_SYNC_ACCESS_TOKEN=...
TIKTOK_LISTING_ACCESS_TOKEN=...
TIKTOK_LISTING_CURRENCY=USD
TIKTOK_LISTING_DEFAULT_INVENTORY=25
TIKTOK_LISTING_WAREHOUSE_ID=...
TIKTOK_LISTING_WEIGHT_VALUE=0.3
TIKTOK_LISTING_WEIGHT_UNIT=KILOGRAM
TIKTOK_LISTING_PACKAGE_LENGTH=20
TIKTOK_LISTING_PACKAGE_WIDTH=15
TIKTOK_LISTING_PACKAGE_HEIGHT=5
TIKTOK_LISTING_PACKAGE_UNIT=CENTIMETER
TIKTOK_LISTING_ACTIVATE=1

AGENT_LOOP_INTERVAL_MS=900000
AGENT_SOURCE_TIMEOUT_MS=180000

AGENT_REMOTE_SHELL_HOST=...
AGENT_REMOTE_SHELL_USER=...
AGENT_REMOTE_SSH_PORT=22
AGENT_REMOTE_SSH_IDENTITY_FILE=...
AGENT_REMOTE_SHELL_MODE=ssh
```

## Bring-Up Sequence

1. Inject the environment variables into the hosted dashboard and daemon services.
2. Start the dashboard.
3. Start the daemon.
4. Confirm the dashboard shows environment readiness and new cycle records.
5. Run one manual `agent:research:live` cycle in the same environment used by the daemon.
6. Confirm the run prints query progress and writes a new trace directory.
7. Confirm TikTok webhook delivery reaches the public route.
8. Confirm a real TikTok order produces a CJ draft before attempting live supplier payment.

## What Still Needs Live Validation

- Research needs better cross-source convergence so more real runs clear the two-source gate.
- TikTok live product creation still needs validation against real seller credentials.
- End-to-end order reconciliation still needs a real paid order and shipment-tracking loop.
- Pivot flows still need live deactivation and replacement validation.

## Regression Status

The current repo passed these stable checks during the latest validation pass:

- `npm run typecheck`
- `npm run agent:tools:test`
- `npm run build`
- `npm run agent:runtime:test`
- `npm run agent:ordersync:test`
- `npm run agent:tiktok:listing:test`
- `npm run agent:research:test`
- `npm run lint`
*** Delete File: /home/abhinav/projects/commercebench/cj.md