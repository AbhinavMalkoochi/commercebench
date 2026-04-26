import {
  AgentToolDefinition,
  AgentToolMap,
  AgentToolName,
  AgentToolPolicy,
  AgentToolPolicyContext,
  AgentToolPolicyDecision,
} from "@/agent/core/tools";

export class DefaultToolPolicy implements AgentToolPolicy {
  evaluate<Name extends AgentToolName>(
    tool: AgentToolDefinition<Name, AgentToolMap[Name]["input"], AgentToolMap[Name]["output"]>,
    context: AgentToolPolicyContext,
  ): AgentToolPolicyDecision {
    if (tool.stage !== context.stage) {
      return {
        allowed: false,
        reason: `Tool ${tool.name} is registered for stage ${tool.stage}, not ${context.stage}.`,
      };
    }

    if (tool.risk === "high" && !context.allowHighRiskTools) {
      return {
        allowed: false,
        reason: `Tool ${tool.name} is high risk and high-risk execution is disabled.`,
      };
    }

    if (tool.requiresApproval && !context.approvedToolNames?.includes(tool.name)) {
      return {
        allowed: false,
        reason: `Tool ${tool.name} requires explicit approval before execution.`,
      };
    }

    return {
      allowed: true,
      reason: `Tool ${tool.name} is allowed for stage ${context.stage}.`,
    };
  }
}