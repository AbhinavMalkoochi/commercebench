export const MAX_ALLOWED_PRODUCT_PRICE = 100;
export const MINIMUM_QUERY_COUNT = 8;
export const MINIMUM_USEFUL_SIGNAL_COUNT = 3;

export const RESTRICTED_PRODUCT_KEYWORDS = [
  "adult",
  "alcohol",
  "medical",
  "nicotine",
  "prescription",
  "supplement",
  "supplements",
  "tobacco",
  "vape",
  "weapon",
  "weapons",
] as const;

export type AgentState =
  | "idle"
  | "paused"
  | "running_research"
  | "running_product_creation"
  | "research_complete"
  | "product_creation_complete"
  | "blocked_low_signal"
  | "blocked_manual_review"
  | "error";

export type SourceMode = "direct_fetch" | "search_backed" | "authenticated";
export type SignalKind = "candidate" | "market_theme";

export type SourceId =
  | "tiktok_creative_center"
  | "tiktok_shop_search"
  | "tiktok_hashtag_search"
  | "tiktok_made_me_buy_it_search"
  | "shopify_tiktok_products"
  | "shopify_tiktok_trends"
  | "cj_winning_products"
  | "cj_tiktok_products";

export interface SourceCapability {
  id: SourceId;
  mode: SourceMode;
  title: string;
  primaryUrl: string;
  requiresAuth: boolean;
  notes: string;
}

export interface QueryPlan {
  id: string;
  sourceId: SourceId;
  query: string;
  allowedDomains?: string[];
  freshnessWindowDays?: number;
}

export interface PriceBand {
  currency: "USD";
  min?: number;
  max?: number;
}

export interface MetricVector {
  freshness: number;
  visualDemo: number;
  creatorAppeal: number;
  purchaseIntent: number;
  priceFit: number;
  saturationResistance: number;
  seasonality: number;
  sourceAuthority: number;
}

export interface ResearchSignal {
  id: string;
  kind: SignalKind;
  sourceId: SourceId;
  queryId: string;
  query: string;
  sourceMode: SourceMode;
  sourceUrl?: string;
  sourceTitle?: string;
  sourcePublishedAt?: string;
  label?: string;
  summary: string;
  freshnessNote?: string;
  tags: string[];
  metrics: MetricVector;
  confidence: number;
  priceBand?: PriceBand;
  detectedAt: string;
}

export interface CandidateScore {
  total: number;
  freshness: number;
  signalCoverage: number;
  visualDemo: number;
  creatorAppeal: number;
  purchaseIntent: number;
  priceFit: number;
  saturationResistance: number;
  seasonality: number;
  confidenceMultiplier: number;
  gatePassed: boolean;
  gateReasons: string[];
  reasons: string[];
}

export interface CandidatePortfolioEntry {
  key: string;
  label: string;
  tags: string[];
  evidence: ResearchSignal[];
  sourceIds: SourceId[];
  score: CandidateScore;
}

export interface ResearchDecision {
  selectedCandidateKey: string;
  backupCandidateKeys: string[];
  reasoning: string;
}

export interface ResearchCycleResult {
  status: "passed" | "blocked_low_signal";
  startedAt: string;
  completedAt: string;
  queries: QueryPlan[];
  signals: ResearchSignal[];
  candidates: CandidatePortfolioEntry[];
  selectedCandidate?: CandidatePortfolioEntry;
  backupCandidates: CandidatePortfolioEntry[];
  decision?: ResearchDecision;
  reasoning: string;
  sourceAudit: SourceCapability[];
}

export interface AgentCycleRecord {
  cycleId: string;
  startedAt: string;
  completedAt: string;
  result: ResearchCycleResult;
  productCreation?: {
    plan: ProductCreationResult;
    execution?: ProductExecutionResult;
  };
  listingDraft?: ListingDraftResult;
  listingExecution?: TikTokListingExecutionResult;
  orderSync?: OrderSyncResult;
}

export interface ProductMappingRecord {
  mappingKey: string;
  cycleId: string;
  updatedAt: string;
  candidateKey: string;
  candidateLabel: string;
  fulfillmentProvider?: FulfillmentProvider;
  listingHandle?: string;
  cjProductId?: string;
  cjSku?: string;
  tikTokProductId?: string;
  tikTokSkuIds: string[];
  latestListingDraftStatus?: ListingDraftResult["status"];
  latestListingExecutionStatus?: TikTokListingExecutionResult["status"];
}

export interface StoredAgentState {
  currentState: AgentState;
  cycleCount: number;
  lastHeartbeat: string | null;
  lastResultPath?: string;
  lastError?: string;
  consecutiveRuntimeFailures?: number;
  pausedUntil?: string;
}

export interface SourceDocument {
  url: string;
  html: string;
  text: string;
  fetchedAt: string;
}

export interface HtmlSourceClient {
  fetchDocument(url: string): Promise<SourceDocument>;
}

export interface SearchProvider {
  searchSignals(plan: QueryPlan, now: Date): Promise<ResearchSignal[]>;
}

export interface ResearchReasoner {
  decide(input: {
    now: Date;
    queries: QueryPlan[];
    signals: ResearchSignal[];
    candidates: CandidatePortfolioEntry[];
  }): Promise<ResearchDecision>;
}

export interface AgentStateStore {
  readState(): Promise<StoredAgentState>;
  writeState(state: StoredAgentState): Promise<void>;
  appendCycle(record: AgentCycleRecord): Promise<string>;
  readProductMappings(): Promise<ProductMappingRecord[]>;
}

export type FulfillmentProvider = "printful" | "cj_dropshipping";
export type ProductCreationStatus = "draft_ready" | "blocked_manual_review";
export type PrintfulProductFamily =
  | "tshirt"
  | "hoodie"
  | "poster"
  | "mug"
  | "tote"
  | "phone_case";

export interface ProductCreationRequest {
  candidate: CandidatePortfolioEntry;
  maxRetailPrice: number;
  targetMarginFloor: number;
  preferredProvider?: FulfillmentProvider;
}

export interface PricingEnvelope {
  currency: "USD";
  targetRetailPrice: number;
  maxUnitCost: number;
  compareAtPrice?: number;
}

export interface ApprovalRequirement {
  step: "design_review" | "listing_publish" | "supplier_payment" | "sample_order";
  reason: string;
}

export interface PrintfulProductBlueprint {
  provider: "printful";
  productFamily: PrintfulProductFamily;
  designBrief: string;
  requiresGeneratedArtwork: boolean;
}

export interface CjDropshippingProductBlueprint {
  provider: "cj_dropshipping";
  sourcingQuery: string;
  searchKeywords: string[];
  sampleOrderRecommended: boolean;
  requiresManualPaymentApproval: boolean;
}

export type ProductBlueprint = PrintfulProductBlueprint | CjDropshippingProductBlueprint;

export interface ProductCreationDraft {
  candidateKey: string;
  candidateLabel: string;
  fulfillmentProvider: FulfillmentProvider;
  headline: string;
  pricing: PricingEnvelope;
  blueprint: ProductBlueprint;
  approvalRequirements: ApprovalRequirement[];
  notes: string[];
}

export interface ProductCreationResult {
  status: ProductCreationStatus;
  reasoning: string;
  draft?: ProductCreationDraft;
}

export interface PrintfulDraftInspectionSelection {
  productId: number;
  productName: string;
  variantId: number;
  variantName: string;
  unitPrice: number;
  currency: string;
  productSourceUrl: string;
  pricingSourceUrl: string;
}

export interface PrintfulDraftInspectionResult {
  status: "ready" | "skipped" | "blocked";
  reasoning: string;
  selection?: PrintfulDraftInspectionSelection;
}

export interface PrintfulDraftExecutionMockup {
  taskId: number;
  status: string;
  sourceUrl: string;
  assets: Array<{
    catalogVariantId: number;
    placement: string;
    displayName?: string;
    technique?: string;
    styleId?: number;
    mockupUrl: string;
  }>;
  failureReasons: string[];
}

export interface PrintfulDraftExecutionStoreProduct {
  productId: number;
  externalProductId: string;
  name: string;
  variantCount: number;
  syncedCount: number;
  sourceUrl: string;
  thumbnailUrl?: string;
}

export interface PrintfulDraftExecutionResult {
  status: "ready" | "skipped" | "blocked";
  reasoning: string;
  selection?: PrintfulDraftInspectionSelection;
  mockup?: PrintfulDraftExecutionMockup;
  storeProduct?: PrintfulDraftExecutionStoreProduct;
}

export interface ListingDraftArtifact {
  title: string;
  subtitle: string;
  description: string;
  bullets: string[];
  tags: string[];
  heroImageUrl?: string;
  productHandle: string;
  retailPrice: number;
  compareAtPrice?: number;
}

export interface ListingDraftResult {
  status: "ready" | "skipped" | "blocked";
  reasoning: string;
  artifact?: ListingDraftArtifact;
}

export interface CjDraftInspectionSelection {
  productId: string;
  name: string;
  sku?: string;
  price?: number;
  imageUrl?: string;
  sourceUrl: string;
}

export interface CjDraftInspectionResult {
  status: "ready" | "skipped" | "blocked";
  reasoning: string;
  selection?: CjDraftInspectionSelection;
}

export interface CjDraftExecutionResult {
  status: "ready" | "skipped" | "blocked";
  reasoning: string;
  selection?: CjDraftInspectionSelection;
  authentication?: {
    sourceUrl: string;
    openId?: number;
    accessTokenExpiryDate: string;
    refreshTokenExpiryDate: string;
  };
}

export type ProductExecutionResult = PrintfulDraftExecutionResult | CjDraftExecutionResult;

export interface TikTokListingExecutionResult {
  status: "ready" | "skipped" | "blocked";
  reasoning: string;
  productId?: string;
  skuIds?: string[];
  categoryId?: string;
  warehouseId?: string;
  imageUris?: string[];
  warnings?: string[];
}

export interface ObservedTikTokOrder {
  source: "webhook" | "search";
  observedAt: string;
  orderId: string;
  status?: string;
  rawType?: string;
  shippingCountryCode?: string;
  shippingCountry?: string;
  shippingProvince?: string;
  shippingCity?: string;
  shippingCounty?: string;
  shippingZip?: string;
  shippingPhone?: string;
  shippingCustomerName?: string;
  shippingAddress?: string;
  shippingAddress2?: string;
  email?: string;
  products: Array<{
    sellerSku?: string;
    skuId?: string;
    productName?: string;
    quantity: number;
    salePrice?: string;
  }>;
}

export interface SyncedCjOrderDraft {
  sourceOrderId: string;
  observedSource: "webhook" | "search";
  orderStatus?: string;
  cjOrderId?: string;
  cjOrderNumber?: string;
  cjShipmentOrderId?: string;
  cjPayUrl?: string;
  actualPayment?: number;
  orderAmount?: number;
  logisticsMissing?: boolean;
  interceptOrderReasons: Array<{
    code: number;
    message: string;
  }>;
}

export interface CjOrderReconciliationEntry {
  sourceOrderId: string;
  cjOrderId?: string;
  cjOrderStatus?: string;
  cjShipmentOrderId?: string;
  cjTrackingNumber?: string;
  cjLogisticName?: string;
  shippingCountryCode?: string;
  note: string;
}

export interface OrderSyncResult {
  status: "ready" | "skipped" | "blocked";
  reasoning: string;
  observedOrders: ObservedTikTokOrder[];
  createdDrafts: SyncedCjOrderDraft[];
  reconciledOrders: CjOrderReconciliationEntry[];
}

export interface BudgetLedgerEntry {
  id: string;
  action: string;
  amountUsd: number;
  status: "planned" | "executed" | "blocked";
  recordedAt: string;
  referenceId?: string;
}

export interface BudgetCheckResult {
  allowed: boolean;
  remainingBudgetUsd: number;
  remainingAfterActionUsd: number;
  reserveUsd: number;
}

export interface BudgetLedger {
  listEntries(): Promise<BudgetLedgerEntry[]>;
  appendEntry(entry: BudgetLedgerEntry): Promise<void>;
}

export interface ApprovalRequest {
  id: string;
  action: string;
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
  decidedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface ApprovalStore {
  listRequests(): Promise<ApprovalRequest[]>;
  upsertRequest(request: ApprovalRequest): Promise<void>;
}