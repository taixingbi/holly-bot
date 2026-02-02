import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { getMcpTools, getMcpSqlToolName, type McpTool } from "./mcp_client";

const llm = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
  apiKey: process.env.OPENAI_API_KEY,
});

const AgentState = Annotation.Root({
  message: Annotation<string>(),
  response: Annotation<string>(),
});

const AGG_KEYWORDS = [
  "highest",
  "lowest",
  "max",
  "min",
  "average",
  "avg",
  "mean",
  "total",
  "sum",
  "top",
  "most",
  "least",
];

const PAY_KEYWORDS = [
  "salary",
  "pay",
  "paid",
  "compensation",
  "amount",
  "wage",
];

const JOB_KEYWORDS = [
  "job",
  "title",
  "role",
  "position",
  "description",
  "skills",
];

const JURISDICTION_KEYWORDS = [
  "jurisdiction",
  "county",
  "ventura",
  "san bernardino",
  "sanbernardino",
  "sdcounty",
];

async function callModel(state: typeof AgentState.State) {
  const response = await llm.invoke(state.message);
  return { response: (response.content as string) ?? "" };
}

async function callSql(state: typeof AgentState.State) {
  const tools = await getMcpTools();
  const toolName = getMcpSqlToolName();
  const tool = tools.find((t: McpTool) => t.name === toolName);
  if (!tool) {
    const available = tools.map((t: McpTool) => t.name).join(", ");
    const hint =
      tools.length === 0
        ? " MCP_URL may be unset or the MCP server unreachable from this environment."
        : "";
    return {
      response: `MCP tool "${toolName}" not found. Available: ${available || "(none)"}.${hint}`,
    };
  }

  const result = await tool.invoke({ input: state.message });
  const text =
    typeof result === "string"
      ? result
      : typeof result === "object"
        ? JSON.stringify(result)
        : String(result);

  return { response: text };
}

function includesAny(text: string, words: string[]) {
  return words.some((w) => text.includes(w));
}

export function route(state: typeof AgentState.State): "llm" | "sql" {
  const m = state.message.toLowerCase();

  const hasAgg = includesAny(m, AGG_KEYWORDS);
  const hasPay = includesAny(m, PAY_KEYWORDS);
  const hasJob = includesAny(m, JOB_KEYWORDS);
  const hasJurisdiction = includesAny(m, JURISDICTION_KEYWORDS);

  if (hasPay || (hasAgg && hasJurisdiction)) {
    return "sql";
  }

  if (hasJob && hasJurisdiction) {
    return "sql";
  }

  if (hasPay && hasJob) {
    return "sql";
  }

  return "llm";
}

const graphBuilder = new StateGraph(AgentState)
  .addNode("llm", callModel)
  .addNode("sql", callSql)
  .addConditionalEdges(START, route, { llm: "llm", sql: "sql" })
  .addEdge("llm", END)
  .addEdge("sql", END);

export const graph = graphBuilder.compile();
