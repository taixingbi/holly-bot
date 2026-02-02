import { ChatOpenAI } from "@langchain/openai";

/* ----------------------------- Types ----------------------------- */

type Inputs = Record<string, unknown>;
type Outputs = Record<string, unknown>;
type ReferenceOutputs = Record<string, unknown> | undefined;

type EvalResult = {
  key: string;
  score: number;
  comment: string;
};

/* -------------------------- Judge Model --------------------------- */

const judge = new ChatOpenAI({
  model: process.env.EVAL_MODEL ?? "gpt-4o-mini",
  temperature: 0,
  apiKey: process.env.OPENAI_API_KEY,
});

/* --------------------------- Utilities ---------------------------- */

function coerceString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

async function runJudge(
  prompt: string
): Promise<{ score: number; reason: string }> {
  const res = await judge.invoke(prompt);
  const text =
    typeof res.content === "string"
      ? res.content
      : JSON.stringify(res.content);

  const parsed = extractJsonObject(text);
  if (!parsed) {
    return { score: 0, reason: "Could not parse judge output." };
  }

  const score =
    typeof parsed.score === "number"
      ? Math.max(0, Math.min(1, parsed.score))
      : 0;

  const reason =
    typeof parsed.reason === "string"
      ? parsed.reason
      : "No reason provided.";

  return { score, reason };
}

function getQuestionPredictionReference(args: {
  inputs: Inputs;
  outputs: Outputs;
  referenceOutputs?: ReferenceOutputs;
}) {
  const { inputs, outputs, referenceOutputs } = args;

  const question = coerceString(
    inputs?.message ?? inputs?.question ?? inputs?.input ?? ""
  );

  const prediction = coerceString(
    outputs?.answer ?? outputs?.output ?? outputs?.response ?? ""
  );

  const reference = coerceString(
    referenceOutputs?.answer ??
      referenceOutputs?.output ??
      referenceOutputs?.response ??
      ""
  );

  return { question, prediction, reference };
}

/* ------------------------- Evaluators ----------------------------- */

/**
 * Hallucination
 * 1.0 = fully supported by reference
 * 0.5 = minor unsupported detail
 * 0.0 = major hallucination / contradiction
 */
async function hallucinationEval(args: {
  inputs: Inputs;
  outputs: Outputs;
  referenceOutputs?: ReferenceOutputs;
}): Promise<EvalResult> {
  const { question, prediction, reference } =
    getQuestionPredictionReference(args);

  if (!reference.trim()) {
    return {
      key: "hallucination",
      score: 0,
      comment: "Missing reference output; hallucination evaluator requires one.",
    };
  }

  const prompt = `
You are evaluating whether a SQL-backed assistant output contains hallucinations.

Question:
${question}

Model Answer:
${prediction}

Reference Answer (gold):
${reference}

Task:
Decide if the Model Answer introduces facts, numbers, jurisdictions, job titles,
or claims NOT supported by the Reference Answer.

Return ONLY JSON:
{
  "score": number,
  "reason": string
}

Scoring:
- 1.0 = fully supported / no hallucination
- 0.5 = minor unsupported detail
- 0.0 = major hallucination or contradiction
`;

  const { score, reason } = await runJudge(prompt);
  return { key: "hallucination", score, comment: reason };
}

/**
 * Correctness
 * 1.0 = semantically matches reference
 * 0.5 = partially correct
 * 0.0 = incorrect
 */
async function correctnessEval(args: {
  inputs: Inputs;
  outputs: Outputs;
  referenceOutputs?: ReferenceOutputs;
}): Promise<EvalResult> {
  const { question, prediction, reference } =
    getQuestionPredictionReference(args);

  if (!reference.trim()) {
    return {
      key: "correctness",
      score: 0,
      comment: "Missing reference output; correctness evaluator requires one.",
    };
  }

  const prompt = `
You are grading correctness for a SQL-backed assistant.

Question:
${question}

Model Answer:
${prediction}

Reference Answer (gold):
${reference}

Return ONLY JSON:
{
  "score": number,
  "reason": string
}

Rules:
- Treat key entities (jurisdiction, job title) and numbers as critical
- Minor formatting differences are OK
- Empty or non-responsive answers score 0.0
`;

  const { score, reason } = await runJudge(prompt);
  return { key: "correctness", score, comment: reason };
}

/**
 * Conciseness
 * 1.0 = concise and direct
 * 0.5 = acceptable but wordy
 * 0.0 = verbose / irrelevant
 */
async function concisenessEval(args: {
  inputs: Inputs;
  outputs: Outputs;
}): Promise<EvalResult> {
  const { question, prediction } =
    getQuestionPredictionReference(args);

  const prompt = `
You are evaluating conciseness of an assistant answer.

Question:
${question}

Model Answer:
${prediction}

Return ONLY JSON:
{
  "score": number,
  "reason": string
}

Guidelines:
- Prefer short, direct answers
- Penalize unnecessary explanation or fluff
- Do not penalize required context
- Empty or non-responsive answers score 0.0
`;

  const { score, reason } = await runJudge(prompt);
  return { key: "conciseness", score, comment: reason };
}

/* ---------------------- Combined Evaluator ------------------------ */

/**
 * ✅ LangSmith evaluator (Option A)
 * Returns THREE metrics in one run
 */
export default async function llmJudge(args: {
  inputs: Inputs;
  outputs: Outputs;
  referenceOutputs?: ReferenceOutputs;
}): Promise<{ results: EvalResult[] }> {
  const results = await Promise.all([
    hallucinationEval(args),
    correctnessEval(args),
    concisenessEval(args),
  ]);
  return { results };
}

/* ---------------------- Optional Named Exports -------------------- */

export {
  hallucinationEval as hallucination,
  correctnessEval as correctness,
  concisenessEval as conciseness,
};
