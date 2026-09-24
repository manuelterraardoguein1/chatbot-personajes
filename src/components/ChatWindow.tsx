"use client";

import { useState } from "react";
import type { Character } from "@/lib/characters";
import type { ChatErrorCode } from "@/app/api/chat/route";

type Message = {
  role: "user" | "assistant";
  content: string;
  interrupted?: boolean;
};

const DEFAULT_ERROR = "Algo salió mal al hablar con el personaje. Probá de nuevo.";
const ERROR_MESSAGES: Partial<Record<ChatErrorCode, string>> = {
  timeout: "El personaje tardó demasiado en responder. Probá de nuevo.",
  rate_limit: "Demasiados mensajes seguidos. Esperá un momento y probá de nuevo.",
  config: "El servicio no está disponible en este momento. Probá más tarde.",
};
const INTERRUPTED_ERROR = "La respuesta se cortó antes de terminar. Probá de nuevo.";

export default function ChatWindow({ character }: { character: Character }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    setError(null);
    const history = [...messages, { role: "user" as const, content: trimmed }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setIsStreaming(true);

    let errorCode: ChatErrorCode | undefined;
    let receivedText = false;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: character.id,
          messages: history.map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null);
        errorCode = data?.error;
        throw new Error(`Request failed with status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkText = decoder.decode(value, { stream: true });
        if (chunkText) receivedText = true;
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          updated[updated.length - 1] = {
            ...last,
            content: last.content + chunkText,
          };
          return updated;
        });
      }
    } catch {
      if (receivedText) {
        // Keep the partial reply the user already read, but flag it.
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...updated[updated.length - 1], interrupted: true };
          return updated;
        });
        setError(INTERRUPTED_ERROR);
      } else {
        // Nothing arrived: drop the user message and the empty bubble, and
        // put the text back in the input so it can be resent as is.
        setMessages((prev) => prev.slice(0, -2));
        setInput(trimmed);
        setError((errorCode && ERROR_MESSAGES[errorCode]) || DEFAULT_ERROR);
      }
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <div className="flex w-full flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto py-6">
        {messages.length === 0 && (
          <p className="text-center text-sm text-zinc-500">
            Escribile algo a {character.name} para arrancar.
          </p>
        )}
        {messages.map((message, index) => (
          <div
            key={index}
            className={`max-w-[80%] rounded-xl px-4 py-2 text-sm ${
              message.role === "user"
                ? "ml-auto bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
                : "mr-auto bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
            }`}
          >
            {message.content || (isStreaming && index === messages.length - 1 ? "…" : "")}
            {message.interrupted && (
              <span className="mt-1 block text-xs italic text-zinc-500">(respuesta interrumpida)</span>
            )}
          </div>
        ))}
        {error && <p className="text-center text-sm text-red-500">{error}</p>}
      </div>

      <form onSubmit={sendMessage} className="flex gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={`Hablale a ${character.name}...`}
          disabled={isStreaming}
          className="flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700"
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
