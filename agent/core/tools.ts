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

export type AgentToolMap = {
  fetch_web_page: {
    input: FetchWebPageInput;
    output: FetchWebPageOutput;
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