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
  get_tiktok_affiliate: {
    input: GetTikTokAffiliateInput;
    output: GetTikTokAffiliateOutput;
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