# GetGo

Sueltas lo que tienes en la cabeza (voz o texto), la app lo ordena y te enseña **una sola tarea a la vez**.

Stack: **Expo (SDK 58) + Expo Router + TypeScript**, **Supabase** (datos, login anónimo y Edge Functions), **Claude** para entender el texto y **Whisper** (o compatible) para la voz.

## Puesta en marcha

```bash
npm install
cp .env.example .env      # opcional: sin Supabase funciona en modo local
npx expo start
```

La grabación de voz usa `expo-audio`. Si no funciona en Expo Go, crea un development build:
`npx expo run:ios` / `npx expo run:android`, o `npx eas-cli@latest build --profile development`.

### Modo local (sin backend)
Sin las variables de `.env`, la app usa el **parser local** (`src/lib/parse-local.ts`, solo en español) y, al hablar, un **texto de ejemplo** en vez de la transcripción real. Así puedes probar todo el flujo sin configurar nada.

## Supabase

1. Crea un proyecto en Supabase y activa **Anonymous sign-ins** (Authentication → Providers).
2. Aplica la migración: `npx supabase db push` (o pega `supabase/migrations/*.sql` en el SQL editor).
3. Secretos de las funciones:
   ```bash
   npx supabase secrets set ANTHROPIC_API_KEY=... OPENAI_API_KEY=...
   # opcionales: ANTHROPIC_MODEL, TRANSCRIBE_MODEL, TRANSCRIBE_URL
   ```
4. Despliega: `npx supabase functions deploy plan-day` y `npx supabase functions deploy transcribe`.
5. Pon la URL y la key en `.env`.

## Cómo funciona

| Paso | Dónde |
|---|---|
| Inicio → hablar (+ escribir) | `src/app/index.tsx`, `escuchando.tsx`, `escribir.tsx` |
| Texto → tareas (IA, con fallback local) | `src/lib/ai.ts`, `supabase/functions/plan-day` |
| Orden del día (reglas fijas, sin IA) | `src/lib/planner.ts` |
| Resumen editable "Tu día" | `src/app/resumen.tsx` |
| Una tarea a la vez / No puedo ahora | `src/app/ahora.tsx`, `no-puedo.tsx` |
| Racha y comodines por nivel | `src/lib/streak.ts` |
| Estado local + copia en Supabase | `src/store/day.ts`, `src/lib/sync.ts` |

**La IA solo entiende el texto; el orden lo decide el código**, con estas reglas: lo que vence en ≤ 48 h entra seguro · se empieza por algo rápido (≤ 10 min) · lo difícil cuando hay energía (si estás cansado/a, se acorta) · estudio antes que deporte y fuerza antes que cardio · recados al final · como mucho el 80 % del tiempo libre · máximo de tareas por nivel (3 / 5 / 7) · lo que dura más de 1 h se parte.

## Idiomas

La app usa el idioma del móvil. Textos en `src/i18n/strings.ts` (es, en, fr, nl, de, pt, it). Para añadir uno: copia el bloque `es`, tradúcelo y añádelo a `dictionaries`. La IA responde en el idioma en que hablas y la transcripción detecta el idioma. Conviene que un nativo revise cada traducción antes de publicar.

## Scripts

```bash
npm run typecheck   # TypeScript
npm test            # tests de la lógica (planificador, parser, racha)
```

## Siguiente

Onboarding + nivel de exigencia, aviso diario (notificaciones), paywall con RevenueCat, ajustes y cancelación — ya diseñados en el canvas.
