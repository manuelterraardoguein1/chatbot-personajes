import Groq from "groq-sdk";
import { getCharacterById } from "@/lib/characters";

// Max wait for Groq to start responding (per attempt).
const REQUEST_TIMEOUT_MS = 15_000;
// Max silence between chunks once the stream has started.
const STREAM_IDLE_TIMEOUT_MS = 15_000;

type IncomingMessage = { role: "user" | "assistant"; content: string };

export type ChatErrorCode =
  | "bad_request"
  | "not_found"
  | "config"
  | "rate_limit"
  | "timeout"
  | "upstream";

function errorResponse(code: ChatErrorCode, status: number) {
  return Response.json({ error: code }, { status });
}

function classifyGroqError(error: unknown): [ChatErrorCode, number] {
  if (error instanceof Groq.APIConnectionTimeoutError) return ["timeout", 504];
  if (error instanceof Groq.AuthenticationError) return ["config", 500];
  if (error instanceof Groq.PermissionDeniedError) return ["config", 500];
  if (error instanceof Groq.RateLimitError) return ["rate_limit", 429];
  return ["upstream", 502];
}

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error("GROQ_API_KEY is not set");
    return errorResponse("config", 500);
  }

  let body: { characterId?: unknown; messages?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorResponse("bad_request", 400);
  }
  if (typeof body.characterId !== "string" || !Array.isArray(body.messages)) {
    return errorResponse("bad_request", 400);
  }

  const character = getCharacterById(body.characterId);
  if (!character) {
    return errorResponse("not_found", 404);
  }

  const groq = new Groq({ apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: 1 });

  let completion;
  try {
    completion = await groq.chat.completions.create(
      {
        model: "openai/gpt-oss-120b",
        messages: [
          { role: "system", content: character.systemPrompt },
          ...(body.messages as IncomingMessage[]),
        ],
        stream: true,
      },
      // If the browser disconnects, stop generating tokens nobody will read.
      { signal: request.signal },
    );
  } catch (error) {
    const [code, status] = classifyGroqError(error);
    if (!request.signal.aborted) console.error(`Groq request failed (${code}):`, error);
    return errorResponse(code, status);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Groq's timeout only covers the wait for the first byte, so a stream
      // that stalls midway needs its own watchdog, reset on every chunk.
      let stalled = false;
      let idleTimer: ReturnType<typeof setTimeout> | undefined;
      const resetIdleTimer = () => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          stalled = true;
          completion.controller.abort();
        }, STREAM_IDLE_TIMEOUT_MS);
      };

      resetIdleTimer();
      try {
        for await (const chunk of completion) {
          resetIdleTimer();
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) controller.enqueue(encoder.encode(text));
        }
        // An aborted Groq stream ends the loop silently instead of throwing.
        if (stalled) {
          throw new Error(`Groq stream stalled for ${STREAM_IDLE_TIMEOUT_MS}ms`);
        }
        controller.close();
      } catch (error) {
        if (request.signal.aborted) return;
        console.error("Error while streaming Groq response:", error);
        // The 200 status is already sent, so the only way to tell the client
        // the reply is incomplete is to abort the stream instead of closing it.
        controller.error(error);
      } finally {
        clearTimeout(idleTimer);
      }
    },
    cancel() {
      completion.controller.abort();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
