import Groq from "groq-sdk";
import { getCharacterById } from "@/lib/characters";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

type IncomingMessage = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  const { characterId, messages } = (await request.json()) as {
    characterId: string;
    messages: IncomingMessage[];
  };

  const character = getCharacterById(characterId);
  if (!character) {
    return new Response("Character not found", { status: 404 });
  }

  let completion;
  try {
    completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: character.systemPrompt },
        ...messages,
      ],
      stream: true,
    });
  } catch (error) {
    console.error("Groq request failed:", error);
    return new Response("Failed to reach Groq", { status: 502 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of completion) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) controller.enqueue(encoder.encode(text));
        }
      } catch (error) {
        console.error("Error while streaming Groq response:", error);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
