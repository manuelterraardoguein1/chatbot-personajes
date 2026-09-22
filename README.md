# Chatbot de Personajes

## Problema

Chatbot donde el usuario elige un personaje ficticio (ej: Gandalf, Darth Vader) de una lista y conversa con él, con respuestas generadas en tiempo real (streaming) vía un modelo de lenguaje.

## Stack y decisiones técnicas

- **Next.js (App Router) + TypeScript**: permite tener frontend y backend (API routes) en un mismo proyecto, sin exponer credenciales al cliente. El ruteo se basa en la estructura de carpetas dentro de `src/app`.
- **Tailwind CSS v4**: estilos utility-first, configurados directo en `globals.css` (sin `tailwind.config.js`, es el nuevo enfoque CSS-first de la v4).
- **Groq API**: motor de inferencia para las respuestas del modelo. Se llama desde una API route del servidor, nunca desde el navegador, para no exponer la API key.
- **Sin base de datos**: la lista de personajes vive en código por ahora; no hay persistencia de conversaciones.

## Cómo correrlo localmente

```bash
npm install
cp .env.example .env.local   # completar con tu GROQ_API_KEY
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## Demo

_Pendiente de deploy en Vercel._
