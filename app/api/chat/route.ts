import { NextRequest } from "next/server";
import { graph, route } from "@/lib/graph-core";
import { getCachedResponse, setCachedResponse } from "@/lib/query-cache";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { message } = (await req.json()) as { message?: string };
  if (!message || typeof message !== "string") {
    return new Response(JSON.stringify({ error: "Missing message" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const cached = getCachedResponse(message);
  if (cached !== null) {
    return new Response(
      JSON.stringify({ cached: true, response: cached }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {

        const status = route({ message, response: "" });
        send("status", status === "llm" ? "thinking" : "searching_sql");

        let capturedRunId: string | undefined;

        const result = await graph.invoke(
          { message },
          {
            tags: ["nextjs", "langgraph", "v:1.01"],
            metadata: { route_hint: "auto" },
            callbacks: [
              {
                handleChainStart: (chain: unknown, inputs: Record<string, unknown>, runId: string, parentRunId?: string) => {
                  // Capture the root run id (when there's no parent)
                  if (!parentRunId && !capturedRunId) {
                    capturedRunId = runId;
                  }
                },
              },
            ],
          }
        );

        const response = result.response ?? "";
        setCachedResponse(message, response);
        send("result", { response, run_id: capturedRunId });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send("error", msg);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
