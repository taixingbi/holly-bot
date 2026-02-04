import { NextRequest } from "next/server";
import { Client } from "langsmith";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { run_id, rating, feedback } = (await req.json()) as {
    run_id?: string;   // LangGraph run id (UUID)
    rating?: number;   // 1..5
    feedback?: string; // optional text
  };

  if (!run_id) {
    return new Response(JSON.stringify({ error: "Missing run_id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // rating is optional, but if present validate
  if (rating !== undefined && (typeof rating !== "number" || rating < 1 || rating > 5)) {
    return new Response(JSON.stringify({ error: "rating must be 1..5" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const client = new Client(); // uses LANGSMITH_API_KEY, etc.

    const score = rating ? rating / 5 : undefined;
    console.log(`Saving LangSmith feedback - Run ID: ${run_id}, Rating: ${rating}, Score: ${score}`);

    // Attach feedback to the EXISTING LangSmith run
    await client.createFeedback(run_id, "user_rating", {
      score: score,       // 0..1 (optional)
      value: rating ?? undefined,                   // store raw stars too (optional)
      comment: feedback ?? undefined,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to save feedback";
    console.error("Failed to save LangSmith feedback:", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
