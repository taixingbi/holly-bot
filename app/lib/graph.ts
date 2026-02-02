"use server";

import { graph } from "./graph-core";

export async function invokeLLM(message: string) {
  const result = await graph.invoke(
    { message },
    {
      tags: ["nextjs", "langgraph", "v:1.01"],
      metadata: { route_hint: "auto" },
    }
  );
  return result.response ?? "";
}
