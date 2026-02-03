// app/eva/run_eval.ts
import { config as loadEnv } from "dotenv";
import { resolve } from "path";

loadEnv({ path: resolve(process.cwd(), ".env.local") });

import { readFileSync } from "fs";
import { Client } from "langsmith";
import { evaluate, type EvaluatorT } from "langsmith/evaluation";
import { config } from "../lib/config";
import { graph } from "../lib/graph-core";
import llmJudge, { hallucination, correctness, conciseness } from "./evaluators/llm_judge";

const DATASET_NAME = config.eval.dataset;

type ExampleKV = {
  inputs: { message: string };
  outputs: { answer: string };
  metadata?: Record<string, unknown>;
};

const EXAMPLES: ExampleKV[] = JSON.parse(
  readFileSync(resolve(process.cwd(), "app/eva/gold_examples.json"), "utf8")
);

function requiredEnv(name: string, fallback?: string) {
  const val = process.env[name] ?? (fallback && process.env[fallback]);
  if (!val) throw new Error(`Missing env: ${name}${fallback ? ` or ${fallback}` : ""}`);
  if (!process.env[name] && fallback) process.env[name] = val;
}

async function getOrCreateDataset(client: Client) {
  const existing = [];
  for await (const ds of client.listDatasets({ datasetName: DATASET_NAME })) {
    existing.push(ds);
  }
  if (existing.length > 0) return existing[0];

  return await client.createDataset(DATASET_NAME, {
    description: "Eval set for LangGraph routing + MCP SQL tool answers",
    dataType: "kv",
  });
}

async function ensureExamples(client: Client, datasetId: string) {
  // Pull existing examples, match by inputs.message
  const have = new Set<string>();
  for await (const ex of client.listExamples({ datasetId })) {
    const msg = (ex.inputs as { message?: string })?.message;
    if (typeof msg === "string") have.add(msg);
  }

  const toCreate = EXAMPLES.filter((e) => !have.has(e.inputs.message));
  if (toCreate.length === 0) return;

  await client.createExamples({
    datasetId,
    inputs: toCreate.map((e) => e.inputs),
    outputs: toCreate.map((e) => e.outputs),
    metadata: toCreate.map((e) => e.metadata ?? {}),
  });
}

async function targetFn(inputs: { message: string }) {
  const result = await graph.invoke(
    { message: inputs.message },
    {
      tags: ["nextjs", "langgraph", "v:1.01", "eval"],
      metadata: { route_hint: "auto", source: "langsmith-eval" },
    }
  );

  return { answer: result.response ?? "" };
}

async function main() {
  requiredEnv("LANGSMITH_API_KEY", "LANGCHAIN_API_KEY");
  requiredEnv("OPENAI_API_KEY");

  const client = new Client();

  const dataset = await getOrCreateDataset(client);
  await ensureExamples(client, dataset.id);

  const results = await evaluate(targetFn, {
    data: DATASET_NAME,
    evaluators: [hallucination, correctness, conciseness],
    client,
    experimentPrefix: config.eval.experimentPrefix,
    description: "Evaluate LangGraph routing + MCP SQL answers",
    maxConcurrency: config.eval.concurrency,
  });

  console.log("✅ Eval done. Experiment:", results.experimentName);
}

main().catch((e) => {
  console.error("❌ Eval failed:", e);
  if (
    e?.message?.includes("Project not found") ||
    e?.message?.includes("tracer session not found")
  ) {
    console.error(
      "\n💡 LangSmith config tip: Create project in smith.langchain.com first, or set LANGCHAIN_PROJECT to an existing project name."
    );
  }
  process.exit(1);
});
