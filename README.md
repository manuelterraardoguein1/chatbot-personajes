# Chatbot de Personajes

Chateá con personajes de ficción (Gandalf, Darth Vader, Yoda, Sherlock Holmes). Las respuestas se generan con un modelo de lenguaje y aparecen palabra por palabra, en tiempo real.

**Demo:** [chatbot-personajes.vercel.app](https://chatbot-personajes.vercel.app)

## Problema

Un modelo de lenguaje "pelado" responde con una voz genérica. Este proyecto le da a cada personaje su propia personalidad a través de un _system prompt_, y le muestra la respuesta al usuario mientras se va generando. Así la conversación se siente fluida, sin tener que esperar varios segundos a que llegue el texto completo.

## Decisiones técnicas

### Next.js (App Router) + API routes

Frontend y backend viven en el mismo proyecto. La página del chat corre en el navegador, pero la llamada al modelo se hace desde una API route (`src/app/api/chat/route.ts`) que corre en el servidor. Por eso la API key de Groq nunca llega al cliente: si el navegador llamara directo a Groq, cualquiera podría verla en las herramientas de desarrollador.

El ruteo se deduce de la estructura de carpetas: `src/app/chat/[characterId]/page.tsx` atiende URLs como `/chat/gandalf`. Si el `id` no corresponde a ningún personaje, se devuelve un 404.

### Streaming con Groq

- **Del modelo al servidor:** la API route llama a Groq con `stream: true`. En vez de una respuesta completa, recibe un iterador asíncrono de fragmentos (_chunks_), cada uno con unos pocos tokens.
- **Del servidor al navegador:** la route arma un `ReadableStream` y va encolando cada fragmento a medida que llega de Groq. La respuesta HTTP empieza a enviarse antes de que el modelo termine de generar.
- **Texto plano en vez de SSE:** el stream es `text/plain` y lleva solo el texto de la respuesta. Como hay un único tipo de dato para mandar, no hace falta el formato de eventos de Server-Sent Events, y el cliente queda más simple.
- **Modelo:** `openai/gpt-oss-120b` en Groq. Groq ofrece inferencia muy rápida y un plan gratuito. Arrancamos con `llama-3.3-70b-versatile`, pero Groq lo dio de baja y lo cambiamos.

### Manejo de estado

Todo el estado del chat vive en el componente `ChatWindow` con `useState`: la lista de mensajes, el texto del input, si hay una respuesta en curso y un posible error.

- **Mensaje "en construcción":** al enviar, se agregan el mensaje del usuario y un mensaje vacío del asistente. Cada chunk que llega se concatena a ese último mensaje, y la UI se re-renderiza mostrando el texto a medida que crece.
- **Actualización funcional (`setMessages(prev => ...)`):** los chunks llegan más rápido que los renders de React. Si cada actualización partiera de la variable `messages` del render en que arrancó el envío, todas verían el mismo estado viejo y se pisarían entre sí. Con la forma funcional, cada actualización parte del resultado de la anterior.
- **Servidor sin estado:** el modelo no recuerda conversaciones anteriores, así que el cliente manda el historial completo en cada request. El servidor no guarda nada. La contra es que el request crece a medida que avanza la conversación, algo aceptable para charlas cortas.
- **Input bloqueado durante el streaming:** evita que se mezclen dos respuestas en el mismo mensaje.

### Manejo de errores

Con streaming, el status HTTP (200) sale junto con el primer chunk y después ya no se puede cambiar. Por eso hay dos caminos:

- **Antes de empezar a streamear**, la API route responde con un status y un código, por ejemplo `504 { "error": "timeout" }`. El cliente traduce cada código a un mensaje en español, y el detalle técnico queda solo en los logs del servidor.
- **En medio del stream**, la única forma de avisar es abortarlo con `controller.error()` en vez de cerrarlo. Así, en el cliente `reader.read()` lanza una excepción y una respuesta cortada no se confunde con una terminada.

Casos cubiertos:

| Situación | Qué hace el servidor | Qué ve el usuario |
|---|---|---|
| Groq no empieza a responder | Timeout de 15s y 1 reintento (el SDK trae 60s y 2 reintentos por defecto), después `504` | "Tardó demasiado", con su texto de vuelta en el input |
| Groq se traba a mitad de respuesta | Un _watchdog_ que se reinicia con cada chunk corta el stream tras 15s de silencio. El timeout del SDK solo cubre la espera hasta que llega el primer byte | Conserva lo que ya leyó, marcado como "respuesta interrumpida" |
| API key inválida o ausente | Loguea la causa real y responde `500` sin exponer detalles | "El servicio no está disponible" |
| Límite de uso de Groq (429) | Responde `429` | "Demasiados mensajes, esperá un momento" |
| El usuario cierra la pestaña | Aborta el pedido a Groq para no gastar cuota en tokens que nadie va a leer | — |

Cuando el error llega antes de cualquier texto, se sacan de la conversación el mensaje del usuario y la burbuja vacía, y el texto vuelve al input. Así se puede reenviar sin que quede duplicado en el historial.

Un detalle del SDK de Groq: cuando se aborta un stream, el `for await` termina en silencio en vez de lanzar una excepción. Por eso, después del loop, la route revisa si el watchdog se disparó y en ese caso lanza el error ella misma.

### Personajes en código, sin base de datos

Los personajes y sus system prompts están en `src/lib/characters.ts`. Con cuatro personajes fijos, una base de datos solo agregaría complejidad. Tampoco se guardan conversaciones: al recargar la página, el chat empieza de cero.

### Tailwind CSS v4

Estilos _utility-first_ configurados directamente en `globals.css`. La v4 no necesita `tailwind.config.js`.

## Estructura

```
src/
├── app/
│   ├── page.tsx                    # Selección de personaje
│   ├── chat/[characterId]/page.tsx # Página del chat (ruta dinámica)
│   └── api/chat/route.ts           # API route: llama a Groq y hace streaming
├── components/
│   └── ChatWindow.tsx              # UI y estado del chat (componente cliente)
└── lib/
    └── characters.ts               # Personajes y system prompts
```

## Cómo correrlo localmente

Requisitos: Node.js 20.9 o superior y una API key de Groq (se saca gratis en [console.groq.com/keys](https://console.groq.com/keys)).

```bash
npm install
cp .env.example .env.local   # completar GROQ_API_KEY
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

`.env.local` está en `.gitignore`, así que la key nunca se commitea.
