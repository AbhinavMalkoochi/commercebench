export type AgentRuntimeStage =
  | "research"
  | "product_creation"
  | "listing"
  | "marketing"
  | "monitoring"
  | "pivoting";

export type AgentToolRisk = "low" | "medium" | "high";

export interface AgentToolExecutionContext {
  now: Date;
  fetchImpl?: typeof fetch;
}

export interface AgentToolPolicyContext {
  stage: AgentRuntimeStage;
  approvedToolNames?: AgentToolName[];
  allowHighRiskTools?: boolean;
}

export interface AgentToolPolicyDecision {
  allowed: boolean;
  reason: string;
}

export interface AgentToolDefinition<Name extends string, Input, Output> {
  name: Name;
  description: string;
  stage: AgentRuntimeStage;
  risk: AgentToolRisk;
  requiresApproval: boolean;
  execute(input: Input, context: AgentToolExecutionContext): Promise<Output>;
}

export interface AgentAffiliateProfile {
  handle: string;
  displayName?: string;
  category?: string;
  followerCountText?: string;
  profileUrl?: string;
  rawText: string;
}

export interface GetTikTokAffiliateInput {
  query: string;
  region?: string;
  limit?: number;
  pageUrl?: string;
  html?: string;
}

export interface GetTikTokAffiliateOutput {
  query: string;
  sourceUrl: string;
  fetchedAt: string;
  affiliates: AgentAffiliateProfile[];
  notes: string[];
}

export interface GetTikTokAccessTokenInput {
  appKey: string;
  appSecret: string;
  authCode: string;
}

export interface RefreshTikTokAccessTokenInput {
  appKey: string;
  appSecret: string;
  refreshToken: string;
}

export interface TikTokAccessTokenOutput {
  fetchedAt: string;
  sourceUrl: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpireInSeconds?: number;
  refreshTokenExpireInSeconds?: number;
  openId?: string;
  sellerName?: string;
}

export interface TikTokAuthorizedShop {
  id: string;
  cipher: string;
  code?: string;
  name?: string;
  region?: string;
  sellerType?: string;
}

export interface GetTikTokAuthorizedShopsInput {
  appKey: string;
  appSecret: string;
  accessToken: string;
}

export interface GetTikTokAuthorizedShopsOutput {
  fetchedAt: string;
  sourceUrl: string;
  shops: TikTokAuthorizedShop[];
}

export interface TikTokShopProductSummary {
  id: string;
  title: string;
  status: string;
  skuCount: number;
  salesRegions: string[];
  listingQualityTier?: string;
  auditStatus?: string;
}

export interface SearchTikTokProductsInput {
  appKey: string;
  appSecret: string;
  accessToken: string;
  shopCipher: string;
  pageSize?: number;
  pageToken?: string;
  status?: "ALL" | "DRAFT" | "PENDING" | "FAILED" | "ACTIVATE" | "SELLER_DEACTIVATED" | "PLATFORM_DEACTIVATED" | "FREEZE" | "DELETED";
  sellerSkus?: string[];
}

export interface SearchTikTokProductsOutput {
  fetchedAt: string;
  sourceUrl: string;
  totalCount: number;
  nextPageToken?: string;
  products: TikTokShopProductSummary[];
}

export interface RunRemoteShellCommandInput {
  command: string;
  workingDirectory?: string;
  timeoutSeconds?: number;
  host?: string;
  user?: string;
  port?: number;
  identityFile?: string;
  mode?: "ssh" | "local";
}

export interface RunRemoteShellCommandOutput {
  executedAt: string;
  mode: "ssh" | "local";
  host: string;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface FetchWebPageInput {
  url: string;
  maxCharacters?: number;
}

export interface FetchWebPageOutput {
  url: string;
  fetchedAt: string;
  statusCode: number;
  title?: string;
  text: string;
}

export interface PrintfulCatalogVariantSummary {
  id: number;
  name: string;
  price?: number;
}

export interface PrintfulCatalogProduct {
  id: number;
  name: string;
  description?: string;
  categoryId?: number;
  variants: PrintfulCatalogVariantSummary[];
}

export interface GetPrintfulProductsInput {
  categoryId?: number;
  pageUrl?: string;
}

export interface GetPrintfulProductsOutput {
  fetchedAt: string;
  sourceUrl: string;
  products: PrintfulCatalogProduct[];
}

export interface GetPrintfulVariantPricesInput {
  variantId: number;
  storeId: string;
  currency?: string;
  sellingRegionName?: string;
  pageUrl?: string;
}

export interface GetPrintfulVariantPricesOutput {
  fetchedAt: string;
  sourceUrl: string;
  variantId: number;
  currency: string;
  price: number;
}

export interface CreatePrintfulMockupTaskPlacement {
  placement: string;
  technique: string;
  printAreaType: string;
  imageUrl: string;
  position: {
    width: number;
    height: number;
    top: number;
    left: number;
  };
}

export interface CreatePrintfulMockupTaskInput {
  storeId: string;
  catalogProductId: number;
  catalogVariantIds: number[];
  mockupStyleIds: number[];
  placements: CreatePrintfulMockupTaskPlacement[];
  format?: "jpg" | "png";
  mockupWidthPx?: number;
  orientation?: "vertical" | "horizontal";
  pageUrl?: string;
}

export interface CreatePrintfulMockupTaskOutput {
  fetchedAt: string;
  sourceUrl: string;
  taskId: number;
  status: string;
}

export interface GetPrintfulMockupTaskInput {
  taskId: number;
  storeId: string;
  pageUrl?: string;
}

export interface PrintfulMockupAsset {
  catalogVariantId: number;
  placement: string;
  displayName?: string;
  technique?: string;
  styleId?: number;
  mockupUrl: string;
}

export interface GetPrintfulMockupTaskOutput {
  fetchedAt: string;
  sourceUrl: string;
  taskId: number;
  status: string;
  assets: PrintfulMockupAsset[];
  failureReasons: string[];
}

export interface CreatePrintfulStoreProductInput {
  storeId: string;
  externalProductId: string;
  externalVariantId: string;
  name: string;
  variantId: number;
  retailPrice: number;
  artworkUrl: string;
  thumbnailUrl?: string;
  sku?: string;
  pageUrl?: string;
}

export interface CreatePrintfulStoreProductOutput {
  fetchedAt: string;
  sourceUrl: string;
  productId: number;
  externalProductId: string;
  name: string;
  variantCount: number;
  syncedCount: number;
  thumbnailUrl?: string;
}

export interface CjProductSummary {
  productId: string;
  name: string;
  sku?: string;
  price?: number;
}

export interface QueryCjProductsInput {
  accessToken: string;
  name?: string;
  sku?: string;
  pageUrl?: string;
}

export interface QueryCjProductsOutput {
  fetchedAt: string;
  sourceUrl: string;
  products: CjProductSummary[];
}

export interface GetCjAccessTokenInput {
  apiKey: string;
  pageUrl?: string;
}

export interface RefreshCjAccessTokenInput {
  refreshToken: string;
  pageUrl?: string;
}

export interface CjAccessTokenOutput {
  fetchedAt: string;
  sourceUrl: string;
  openId?: number;
  accessToken: string;
  accessTokenExpiryDate: string;
  refreshToken: string;
  refreshTokenExpiryDate: string;
  createdAt?: string;
}

export interface GetCjBalanceInput {
  accessToken: string;
  pageUrl?: string;
}

export interface GetCjBalanceOutput {
  fetchedAt: string;
  sourceUrl: string;
  balance: number;
  currency: "USD";
}

export interface CreateCjOrderDraftItemInput {
  vid?: string;
  sku?: string;
  quantity: number;
  unitPrice?: number;
  storeLineItemId?: string;
}

export interface CreateCjOrderDraftInput {
  accessToken: string;
  platformToken?: string;
  orderNumber: string;
  shippingCountryCode: string;
  shippingCountry: string;
  shippingProvince: string;
  shippingCity: string;
  shippingCustomerName: string;
  shippingAddress: string;
  logisticName: string;
  fromCountryCode: string;
  products: CreateCjOrderDraftItemInput[];
  shippingZip?: string;
  shippingCounty?: string;
  shippingPhone?: string;
  shippingAddress2?: string;
  houseNumber?: string;
  email?: string;
  taxId?: string;
  remark?: string;
  consigneeId?: string;
  shopAmount?: number;
  iossType?: 1 | 2 | 3;
  iossNumber?: string;
  platform?: string;
  shopLogisticsType?: 1 | 2 | 3;
  storageId?: string;
  storeName?: string;
  storeOrderTimeSeconds?: number;
  pageUrl?: string;
}

export interface CjOrderDraftInterceptionReason {
  code: number;
  message: string;
}

export interface CjOrderDraftProductInfo {
  storeLineItemId?: string;
  lineItemId?: string;
  variantId?: string;
  quantity?: number;
  isGroup?: boolean;
}

export interface CreateCjOrderDraftOutput {
  fetchedAt: string;
  sourceUrl: string;
  orderId?: string;
  orderNumber?: string;
  shipmentOrderId?: string;
  orderStatus?: string;
  actualPayment?: number;
  orderAmount?: number;
  cjPayUrl?: string;
  logisticsMissing?: boolean;
  productInfoList: CjOrderDraftProductInfo[];
  interceptOrderReasons: CjOrderDraftInterceptionReason[];
}

export type AgentToolMap = {
  fetch_web_page: {
    input: FetchWebPageInput;
    output: FetchWebPageOutput;
  };
  get_printful_products: {
    input: GetPrintfulProductsInput;
    output: GetPrintfulProductsOutput;
  };
  get_printful_variant_prices: {
    input: GetPrintfulVariantPricesInput;
    output: GetPrintfulVariantPricesOutput;
  };
  create_printful_mockup_task: {
    input: CreatePrintfulMockupTaskInput;
    output: CreatePrintfulMockupTaskOutput;
  };
  get_printful_mockup_task: {
    input: GetPrintfulMockupTaskInput;
    output: GetPrintfulMockupTaskOutput;
  };
  create_printful_store_product: {
    input: CreatePrintfulStoreProductInput;
    output: CreatePrintfulStoreProductOutput;
  };
  get_cj_access_token: {
    input: GetCjAccessTokenInput;
    output: CjAccessTokenOutput;
  };
  get_cj_balance: {
    input: GetCjBalanceInput;
    output: GetCjBalanceOutput;
  };
  create_cj_order_draft: {
    input: CreateCjOrderDraftInput;
    output: CreateCjOrderDraftOutput;
  };
  refresh_cj_access_token: {
    input: RefreshCjAccessTokenInput;
    output: CjAccessTokenOutput;
  };
  query_cj_products: {
    input: QueryCjProductsInput;
    output: QueryCjProductsOutput;
  };
  get_tiktok_affiliate: {
    input: GetTikTokAffiliateInput;
    output: GetTikTokAffiliateOutput;
  };
  get_tiktok_access_token: {
    input: GetTikTokAccessTokenInput;
    output: TikTokAccessTokenOutput;
  };
  refresh_tiktok_access_token: {
    input: RefreshTikTokAccessTokenInput;
    output: TikTokAccessTokenOutput;
  };
  get_tiktok_authorized_shops: {
    input: GetTikTokAuthorizedShopsInput;
    output: GetTikTokAuthorizedShopsOutput;
  };
  search_tiktok_products: {
    input: SearchTikTokProductsInput;
    output: SearchTikTokProductsOutput;
  };
  run_remote_shell_command: {
    input: RunRemoteShellCommandInput;
    output: RunRemoteShellCommandOutput;
  };
};

export type AgentToolName = keyof AgentToolMap;

export type AgentToolCall = {
  [Name in AgentToolName]: {
    id: string;
    toolName: Name;
    input: AgentToolMap[Name]["input"];
    estimatedCostUsd?: number;
    budgetAction?: string;
  };
}[AgentToolName];

export interface AgentTaskPlan {
  objective: string;
  steps: AgentToolCall[];
}

export interface AgentTaskStepResult {
  stepId: string;
  toolName: AgentToolName;
  output: unknown;
}

export interface AgentTaskRunResult {
  status: "completed" | "blocked";
  objective: string;
  completedSteps: AgentTaskStepResult[];
  blockedStepId?: string;
  blockedReason?: string;
}

export type AnyAgentToolDefinition = {
  [Name in AgentToolName]: AgentToolDefinition<Name, AgentToolMap[Name]["input"], AgentToolMap[Name]["output"]>;
}[AgentToolName];

export interface AgentToolRegistry {
  listTools(): AnyAgentToolDefinition[];
  listToolsForStage(stage: AgentRuntimeStage): AnyAgentToolDefinition[];
  getTool<Name extends AgentToolName>(name: Name): AgentToolDefinition<Name, AgentToolMap[Name]["input"], AgentToolMap[Name]["output"]>;
}

export interface AgentToolPolicy {
  evaluate<Name extends AgentToolName>(
    tool: AgentToolDefinition<Name, AgentToolMap[Name]["input"], AgentToolMap[Name]["output"]>,
    context: AgentToolPolicyContext,
  ): AgentToolPolicyDecision;
}