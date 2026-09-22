import Link from "next/link";
import { notFound } from "next/navigation";
import { getCharacterById } from "@/lib/characters";
import ChatWindow from "@/components/ChatWindow";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ characterId: string }>;
}) {
  const { characterId } = await params;
  const character = getCharacterById(characterId);

  if (!character) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-8">
      <div className="flex items-center gap-3 pb-4">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
          ← Volver
        </Link>
        <span className="text-2xl" aria-hidden>
          {character.avatar}
        </span>
        <h1 className="text-lg font-semibold">{character.name}</h1>
      </div>
      <ChatWindow character={character} />
    </main>
  );
}
