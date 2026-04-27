import { getDashboardData } from "@/app/dashboard-data";

export const dynamic = "force-dynamic";

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "Not yet recorded";
  }

  return new Date(value).toLocaleString();
}

function formatBool(value: boolean): string {
  return value ? "Ready" : "Missing";
}

export default async function Home() {
  const data = await getDashboardData();
  const latestCycle = data.cycles[0];

  return (
    <main className="dashboard-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Commercebench Control Room</p>
          <h1>Research, sourcing, listing, and hosted operations in one live surface.</h1>
          <p className="hero-text">
            This dashboard reads the same file-backed runtime state the agent uses, so you can see the live loop,
            recent cycles, trace activity, TikTok readiness, and hosted shell configuration without a separate admin app.
          </p>
        </div>
        <div className="hero-metrics">
          <article className="metric-card accent-amber">
            <span className="metric-label">Runtime State</span>
            <strong>{data.state.currentState}</strong>
            <span className="metric-meta">Last heartbeat: {formatTimestamp(data.state.lastHeartbeat)}</span>
          </article>
          <article className="metric-card accent-cyan">
            <span className="metric-label">Cycle Count</span>
            <strong>{data.state.cycleCount}</strong>
            <span className="metric-meta">Latest result path: {data.state.lastResultPath ?? "No cycle file yet"}</span>
          </article>
          <article className="metric-card accent-red">
            <span className="metric-label">Runtime Errors</span>
            <strong>{data.state.lastError ? "Attention" : "Clear"}</strong>
            <span className="metric-meta">{data.state.lastError ?? "No current runtime error."}</span>
          </article>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="panel panel-wide">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Latest Cycle</p>
              <h2>Research to execution summary</h2>
            </div>
          </div>
          {latestCycle ? (
            <div className="cycle-summary">
              <div className="summary-block">
                <span className="summary-label">Selected candidate</span>
                <strong>{latestCycle.result.selectedCandidate?.label ?? "No candidate selected"}</strong>
              </div>
              <div className="summary-block">
                <span className="summary-label">Product provider</span>
                <strong>{latestCycle.productCreation?.plan.draft?.fulfillmentProvider ?? "Not planned"}</strong>
              </div>
              <div className="summary-block">
                <span className="summary-label">Listing draft</span>
                <strong>{latestCycle.listingDraft?.status ?? "Unavailable"}</strong>
              </div>
              <div className="summary-block">
                <span className="summary-label">Listing publish</span>
                <strong>{latestCycle.listingExecution?.status ?? "Unavailable"}</strong>
              </div>
              <div className="summary-block">
                <span className="summary-label">Order sync</span>
                <strong>{latestCycle.orderSync?.status ?? "Unavailable"}</strong>
              </div>
              <div className="summary-block full-width">
                <span className="summary-label">Reasoning</span>
                <p>{latestCycle.result.reasoning}</p>
              </div>
              {latestCycle.orderSync ? (
                <div className="summary-block full-width">
                  <span className="summary-label">Order sync reasoning</span>
                  <p>{latestCycle.orderSync.reasoning}</p>
                </div>
              ) : null}
              {latestCycle.listingExecution ? (
                <div className="summary-block full-width">
                  <span className="summary-label">Listing publish reasoning</span>
                  <p>{latestCycle.listingExecution.reasoning}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="empty-state">No live cycle has been recorded yet.</p>
          )}
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Environment</p>
              <h2>API and shell readiness</h2>
            </div>
          </div>
          <ul className="status-list">
            <li><span>OpenAI</span><strong>{formatBool(data.environment.openAi)}</strong></li>
            <li><span>Exa</span><strong>{formatBool(data.environment.exa)}</strong></li>
            <li><span>CJ</span><strong>{formatBool(data.environment.cj)}</strong></li>
            <li><span>CJ order sync</span><strong>{formatBool(data.environment.cjOrderSync)}</strong></li>
            <li><span>TikTok app key</span><strong>{formatBool(data.environment.tikTokAppKey)}</strong></li>
            <li><span>TikTok app secret</span><strong>{formatBool(data.environment.tikTokAppSecret)}</strong></li>
            <li><span>TikTok shop cipher</span><strong>{formatBool(data.environment.tikTokShopCipher)}</strong></li>
            <li><span>TikTok order sync token</span><strong>{formatBool(data.environment.tikTokOrderSync)}</strong></li>
            <li><span>TikTok listing token</span><strong>{formatBool(data.environment.tikTokListing)}</strong></li>
            <li><span>Remote shell mode</span><strong>{data.environment.remoteShellMode}</strong></li>
            <li><span>Remote shell host</span><strong>{data.environment.remoteShellHost ?? "Unset"}</strong></li>
          </ul>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Hosting</p>
              <h2>Where the system runs</h2>
            </div>
          </div>
          <div className="stack-list">
            <div>
              <span className="summary-label">Dashboard</span>
              <code>{data.hosting.dashboardCommand}</code>
            </div>
            <div>
              <span className="summary-label">Agent daemon</span>
              <code>{data.hosting.daemonCommand}</code>
            </div>
            <div>
              <span className="summary-label">Container stack</span>
              <code>{data.hosting.containerStack}</code>
            </div>
            <div>
              <span className="summary-label">Shared state volume</span>
              <code>{data.hosting.sharedStatePath}</code>
            </div>
          </div>
        </article>

        <article className="panel panel-wide">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Recent Cycles</p>
              <h2>Decision trail</h2>
            </div>
          </div>
          <div className="timeline">
            {data.cycles.length > 0 ? data.cycles.map((cycle) => (
              <article className="timeline-item" key={cycle.cycleId}>
                <div className="timeline-marker" />
                <div className="timeline-content">
                  <div className="timeline-topline">
                    <strong>{cycle.result.selectedCandidate?.label ?? cycle.result.status}</strong>
                    <span>{formatTimestamp(cycle.completedAt)}</span>
                  </div>
                  <p>{cycle.result.reasoning}</p>
                  <div className="pill-row">
                    <span className="pill">{cycle.result.status}</span>
                    <span className="pill">{cycle.productCreation?.plan.draft?.fulfillmentProvider ?? "no-provider"}</span>
                    <span className="pill">listing {cycle.listingDraft?.status ?? "none"}</span>
                    <span className="pill">publish {cycle.listingExecution?.status ?? "none"}</span>
                    <span className="pill">orders {cycle.orderSync?.status ?? "none"}</span>
                  </div>
                  {cycle.listingExecution ? <p>{cycle.listingExecution.reasoning}</p> : null}
                  {cycle.orderSync ? <p>{cycle.orderSync.reasoning}</p> : null}
                </div>
              </article>
            )) : <p className="empty-state">No cycle files found under `.agent-state/live/cycles`.</p>}
          </div>
        </article>

        <article className="panel panel-wide">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Trace Feed</p>
              <h2>Recent trace directories and events</h2>
            </div>
          </div>
          <div className="trace-grid">
            {data.traces.length > 0 ? data.traces.map((trace) => (
              <article className="trace-card" key={trace.id}>
                <div className="trace-topline">
                  <strong>{trace.metadata.command ? String(trace.metadata.command) : trace.id}</strong>
                  <span>{trace.id}</span>
                </div>
                <ul className="trace-events">
                  {trace.recentEvents.length > 0 ? trace.recentEvents.map((event, index) => (
                    <li key={`${trace.id}-${index}`}>
                      <span>{event.type}</span>
                      <strong>{formatTimestamp(event.timestamp)}</strong>
                    </li>
                  )) : <li><span>No event stream found</span></li>}
                </ul>
              </article>
            )) : <p className="empty-state">No trace directories found yet.</p>}
          </div>
        </article>

        <article className="panel panel-wide">
          <div className="panel-header">
            <div>
              <p className="eyebrow">TikTok Webhooks</p>
              <h2>Recent order-status payloads</h2>
            </div>
          </div>
          <div className="timeline">
            {data.webhooks.length > 0 ? data.webhooks.map((webhook) => {
              const payloadData = webhook.payload.data as { order_id?: string; order_status?: string } | undefined;

              return (
                <article className="timeline-item" key={webhook.id}>
                  <div className="timeline-marker" />
                  <div className="timeline-content">
                    <div className="timeline-topline">
                      <strong>{payloadData?.order_id ?? webhook.id}</strong>
                      <span>{formatTimestamp(webhook.receivedAt)}</span>
                    </div>
                    <p>Order status: {payloadData?.order_status ?? "unknown"}</p>
                    <div className="pill-row">
                      <span className="pill">type {webhook.type}</span>
                      <span className="pill">signature {webhook.signature ? "present" : "missing"}</span>
                    </div>
                  </div>
                </article>
              );
            }) : <p className="empty-state">No TikTok webhook payloads stored yet.</p>}
          </div>
        </article>

        <article className="panel panel-wide">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Order Reconciliation</p>
              <h2>TikTok to CJ sync outcomes</h2>
            </div>
          </div>
          <div className="timeline">
            {data.cycles.flatMap((cycle) => cycle.orderSync?.reconciledOrders ?? []).length > 0 ? data.cycles.flatMap((cycle) => cycle.orderSync?.reconciledOrders ?? []).map((entry) => (
              <article className="timeline-item" key={`${entry.sourceOrderId}-${entry.cjOrderId ?? "missing"}`}>
                <div className="timeline-marker" />
                <div className="timeline-content">
                  <div className="timeline-topline">
                    <strong>{entry.sourceOrderId}</strong>
                    <span>{entry.cjOrderStatus ?? "unknown"}</span>
                  </div>
                  <p>{entry.note}</p>
                  <div className="pill-row">
                    <span className="pill">CJ {entry.cjOrderId ?? "missing"}</span>
                    <span className="pill">shipment {entry.cjShipmentOrderId ?? "n/a"}</span>
                    <span className="pill">tracking {entry.cjTrackingNumber ?? "n/a"}</span>
                  </div>
                </div>
              </article>
            )) : <p className="empty-state">No reconciled CJ orders yet.</p>}
          </div>
        </article>

        <article className="panel panel-wide">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Listing Publish</p>
              <h2>TikTok listing outcomes</h2>
            </div>
          </div>
          <div className="timeline">
            {data.cycles.flatMap((cycle) => cycle.listingExecution ? [{ cycleId: cycle.cycleId, listingExecution: cycle.listingExecution }] : []).length > 0 ? data.cycles.flatMap((cycle) => cycle.listingExecution ? [{ cycleId: cycle.cycleId, listingExecution: cycle.listingExecution }] : []).map((entry) => (
              <article className="timeline-item" key={entry.cycleId}>
                <div className="timeline-marker" />
                <div className="timeline-content">
                  <div className="timeline-topline">
                    <strong>{entry.listingExecution.productId ?? entry.cycleId}</strong>
                    <span>{entry.listingExecution.status}</span>
                  </div>
                  <p>{entry.listingExecution.reasoning}</p>
                  <div className="pill-row">
                    <span className="pill">category {entry.listingExecution.categoryId ?? "n/a"}</span>
                    <span className="pill">warehouse {entry.listingExecution.warehouseId ?? "n/a"}</span>
                    <span className="pill">sku count {entry.listingExecution.skuIds?.length ?? 0}</span>
                  </div>
                </div>
              </article>
            )) : <p className="empty-state">No TikTok listing executions recorded yet.</p>}
          </div>
        </article>

        <article className="panel panel-wide">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Product Mapping</p>
              <h2>Candidate to fulfillment mapping</h2>
            </div>
          </div>
          <div className="timeline">
            {data.productMappings.length > 0 ? data.productMappings.slice(0, 8).map((mapping) => (
              <article className="timeline-item" key={mapping.mappingKey}>
                <div className="timeline-marker" />
                <div className="timeline-content">
                  <div className="timeline-topline">
                    <strong>{mapping.candidateLabel}</strong>
                    <span>{mapping.latestListingExecutionStatus ?? mapping.latestListingDraftStatus ?? "mapped"}</span>
                  </div>
                  <p>{mapping.listingHandle ?? mapping.mappingKey}</p>
                  <div className="pill-row">
                    <span className="pill">CJ {mapping.cjProductId ?? "n/a"}</span>
                    <span className="pill">SKU {mapping.cjSku ?? "n/a"}</span>
                    <span className="pill">TikTok {mapping.tikTokProductId ?? "draft-only"}</span>
                  </div>
                </div>
              </article>
            )) : <p className="empty-state">No persistent product mappings recorded yet.</p>}
          </div>
        </article>
      </section>
    </main>
  );
}
