import Link from "next/link";
import { characters } from "@/lib/characters";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center gap-8 px-6 py-16">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Chatbot de Personajes
        </h1>
        <p className="max-w-md text-zinc-600 dark:text-zinc-400">
          Elegí un personaje y empezá a conversar.
        </p>
      </div>

      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
        {characters.map((character) => (
          <Link
            key={character.id}
            href={`/chat/${character.id}`}
            className="flex items-center gap-4 rounded-xl border border-zinc-200 p-5 transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
          >
            <span className="text-4xl" aria-hidden>
              {character.avatar}
            </span>
            <div>
              <p className="font-medium">{character.name}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {character.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
