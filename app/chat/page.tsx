"use client";

import { useState, useRef } from "react";

type Message = { role: "user" | "assistant"; content: string; run_id?: string };
type Status = "thinking" | "searching_sql" | "cached" | "error" | null;

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [starRatings, setStarRatings] = useState<Map<string, number>>(new Map());
  const listRef = useRef<HTMLDivElement>(null);

  const handleStarRating = async (message: Message, rating: number) => {
    if (!message.run_id) {
      console.error("No run_id available for feedback");
      return;
    }

    const score = rating / 5; // Convert 1-5 stars to 0-1 score
    console.log(`Star rating: ${rating}/5, Score: ${score}`);

    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          run_id: message.run_id,
          rating,
          feedback: "star_rating"
        }),
      });
      setStarRatings(prev => new Map(prev).set(message.content, rating));
    } catch (error) {
      console.error("Failed to save star rating:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);
    setStatus(null);

    try {
      const doFetch = () =>
        fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: userMessage }),
        });

      let res: Response;
      try {
        res = await doFetch();
      } catch (fetchErr) {
        const isFailedFetch =
          fetchErr instanceof TypeError &&
          (fetchErr as Error).message === "Failed to fetch";
        if (isFailedFetch) {
          try {
            res = await doFetch();
          } catch {
            throw new Error(
              "Network error. Check the server is running and try again."
            );
          }
        } else {
          throw fetchErr;
        }
      }
      if (!res.ok) throw new Error("Request failed");

      const contentType = res.headers.get("Content-Type") ?? "";
      if (contentType.includes("application/json")) {
        const json = (await res.json()) as { cached?: boolean; response?: string };
        if (json.response != null) {
          setMessages((prev) => [...prev, { role: "assistant", content: json.response! }]);
        }
        setLoading(false);
        setStatus(null);
        return;
      }

      if (!res.body) throw new Error("Request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const block of lines) {
          const eventMatch = block.match(/^event: (\w+)/m);
          const dataMatch = block.match(/^data: (.+)$/m);
          if (!eventMatch || !dataMatch) continue;
          const [, event] = eventMatch;
          try {
            const data = JSON.parse(dataMatch[1]);
            if (event === "status") setStatus(data as Status);
            if (event === "result") {
              const resultData = typeof data === 'object' && data !== null ? data : { response: data };
              setMessages((prev) => [...prev, { 
                role: "assistant", 
                content: resultData.response || data,
                run_id: resultData.run_id 
              }]);
              setStatus(null);
              setLoading(false);
            }
            if (event === "error") {
              setMessages((prev) => [
                ...prev,
                { role: "assistant", content: `Error: ${data}` },
              ]);
              setStatus(null);
              setLoading(false);
            }
          } catch {
            // skip parse errors
          }
        }
      }

      if (buffer) {
        const eventMatch = buffer.match(/^event: (\w+)/m);
        const dataMatch = buffer.match(/^data: (.+)$/m);
        if (eventMatch && dataMatch) {
          const [, event] = eventMatch;
          try {
            const data = JSON.parse(dataMatch[1]);
            if (event === "status") setStatus(data as Status);
            if (event === "result") {
              const resultData = typeof data === 'object' && data !== null ? data : { response: data };
              setMessages((prev) => [...prev, { 
                role: "assistant", 
                content: resultData.response || data,
                run_id: resultData.run_id 
              }]);
              setStatus(null);
              setLoading(false);
            }
            if (event === "error") {
              setMessages((prev) => [
                ...prev,
                { role: "assistant", content: `Error: ${data}` },
              ]);
              setStatus(null);
              setLoading(false);
            }
          } catch {
            // skip
          }
        }
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${err instanceof Error ? err.message : String(err)}`,
        },
      ]);
    } finally {
      setLoading(false);
      setStatus(null);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-[#0d0d0d] text-[#0d0d0d] dark:text-[#ececec]">
      <header className="shrink-0 flex items-center justify-center border-b border-gray-200 dark:border-gray-700 py-3">
        <h1 className="text-base font-semibold">Chat</h1>
      </header>

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto min-h-0"
      >
        <div className="chat-container px-4 py-6 space-y-6">
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center pt-16 text-center">
              <p className="text-2xl font-medium text-gray-400 dark:text-gray-500 mb-2">
                How can I help you today?
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Ask about jobs, salaries, or anything else.
              </p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex w-full ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
                  msg.role === "user"
                    ? "chat-user-bubble rounded-br-md"
                    : "chat-assistant-bubble rounded-bl-md"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                {msg.role === "assistant" && (
                  <div className="flex justify-end mt-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => handleStarRating(msg, star)}
                          className={`transition-colors ${
                            (starRatings.get(msg.content) || 0) >= star 
                              ? 'text-yellow-400 hover:text-yellow-500' 
                              : 'text-gray-300 hover:text-yellow-400'
                          }`}
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill={(starRatings.get(msg.content) || 0) >= star ? "currentColor" : "none"}
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
                          </svg>
                        </button>
                      ))}
                      {starRatings.get(msg.content) && (
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                          {starRatings.get(msg.content)}/5 ({(starRatings.get(msg.content)! / 5).toFixed(1)})
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start w-full">
              <div className="chat-assistant-bubble rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2 text-[15px] text-gray-500 dark:text-gray-400">
                <span className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-current opacity-60 animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 rounded-full bg-current opacity-60 animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 rounded-full bg-current opacity-60 animate-bounce [animation-delay:300ms]" />
                </span>
                <span>
                  {status === "thinking" && "Thinking…"}
                  {status === "searching_sql" && (
                    <span className="text-gray-500 dark:text-gray-400">Searching SQL…</span>
                  )}
                  {status === "cached" && (
                    <span className="text-gray-500 dark:text-gray-400">From cache…</span>
                  )}
                  {status === "error" && "Error"}
                  {!status && "…"}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="shrink-0 p-4 bg-white dark:bg-[#0d0d0d]"
      >
        <div className="chat-container">
          <div className="chat-input-wrap rounded-2xl flex gap-2 px-4 py-3 transition-colors">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message…"
              disabled={loading}
              className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-gray-500 dark:placeholder:text-gray-400 disabled:opacity-50"
              autoFocus
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="shrink-0 p-2 rounded-lg text-[#10a37f] hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              aria-label="Send"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13" />
                <path d="M22 2L15 22L11 13L2 9L22 2Z" />
              </svg>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
