// Supabase Edge Function (Deno): brain dump text or screenshot -> structured tasks.
// The ORDER of the day is decided in the app (src/lib/planner.ts); the AI only understands the text.
//
// Two providers, chosen by the secrets you set:
//   - Groq (free tier):  GROQ_API_KEY            [GROQ_MODEL, default qwen/qwen3.8-27b]
//   - Anthropic (paid):  ANTHROPIC_API_KEY       [ANTHROPIC_MODEL, default claude-haiku-5-5]
// If both are set, AI_PROVIDER=groq|anthropic decides (default: anthropic).

const ANTHROPIC_MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-haiku-5-5';
const GROQ_MODEL = Deno.env.get('GROQ_MODEL') ?? 'qwen/qwen3.8-27b';
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const SYSTEM = `Eres el motor de Okio, una app que ayuda a personas que piensan demasiado (overthinkers) a llegar a sus metas.
Recibes lo que la persona tiene en la cabeza, dicho sin orden. Tu trabajo es SOLO entenderlo y devolver tareas y metas. No inventes nada.

TAREAS (cosas concretas que hacer):
- Una tarea por ACCIÓN. Si en una frase hay varias acciones ("ir al gym y hacer la comida", "ir al gym, hacer la comida"), son tareas SEPARADAS. Une duplicados. Ignora frases que no son tareas.
- "title": corto, en infinitivo, EN EL IDIOMA de la persona, empezando en mayúscula. Máximo 6 palabras. Sin la lista de cosas ni la hora dentro del título.
- "checklist": lista de cosas concretas dentro de la tarea si las dice: productos de la compra ("huevos", "manzanas"), ejercicios, pasos, puntos de un mail. [] si no dice ninguna.
- "where": el lugar si lo dice ("Basic-Fit Ixelles", "casa de mamá"), si no null.
- "at": la hora si la dice, en formato "HH:MM" 24 h ("a las 6 de la tarde" → "18:00"), si no null.
- "minutes": SOLO lo que dice ("1 hora de gym" → 60, "media hora corriendo" → 30). Si no lo dice, null: NUNCA inventes una duración. La app le preguntará cuánto tiempo.
- "askMinutes": true si "minutes" es null y es una actividad que necesita una duración para ser concreta (correr, gym, entrenar, estudiar, leer, meditar, caminar, practicar, trabajar en algo, ordenar, limpiar). false para el resto (llamar, mandar un mail, comprar, recoger algo).
- "ask": lista (0 a 2) de preguntas cortas para lo que FALTA y cambia la tarea, en el idioma del móvil. Solo si no lo dijo. Cada una: {"q": pregunta, "kind": "minutes" | "text" | "deadline", "template": título con {} donde va la respuesta (solo para "text")}.
  Ejemplos: "leer" → [{"q":"¿Qué libro?","kind":"text","template":"Leer {}"},{"q":"¿Cuánto tiempo quieres leer?","kind":"minutes"}]; "hacer una app" → [{"q":"¿Qué app?","kind":"text","template":"Hacer la app {}"},{"q":"¿Para cuándo la quieres terminar?","kind":"deadline"}]; "estudiar" → [{"q":"¿Qué vas a estudiar?","kind":"text","template":"Estudiar {}"},{"q":"¿Cuánto tiempo?","kind":"minutes"}]; "correr" → [{"q":"¿Cuánto tiempo quieres correr?","kind":"minutes"}]. Nunca preguntes por "llamar a mamá", "comprar pan" o lo que ya está claro. Máximo 4 preguntas en total.
- Cada tarea tiene que ser CONCRETA: no "Hacer deporte" sino "Correr"; no "Estudiar" sino "Estudiar tema 3 de estadística" si lo dice. No pongas la duración en el título. Si falta el lugar y el PERFIL lo da, ponlo en "where".
- LA COMPRA: los productos (huevos, manzanas, pasta…) NUNCA son tareas sueltas: van en "checklist" de UNA tarea "Hacer la compra" (con cantidades si las dice: "Huevos · 12"). Si menciona productos sin decir "compra", crea igualmente esa tarea.
- Lo que es un RESULTADO (pesar 48 kg, aprobar, ahorrar 2000 €) no es una tarea: es una META.
- "dueInDays": días hasta la fecha límite o el día en que debe hacerse (0 = hoy, 1 = mañana). null si no hay.
- "energy": "alta" si exige concentración o esfuerzo físico, si no "baja".
- "kind": "trabajo" | "estudio" | "deporte" | "casa" | "otro".
- "importance": 3 importante (fecha cercana, consecuencias, alguien lo espera), 2 normal, 1 puede esperar.
- "sport": "fuerza" | "cardio" | null. "Gym y cardio" son DOS tareas.
- "proof": si la tarea deja algo que se puede FOTOGRAFIAR para demostrar que está hecha, describe en 2-6 palabras qué foto ("Foto de la compra", "Foto corriendo o del reloj", "Foto de la cocina limpia", "Captura del mail enviado"). null si no hay nada visible (pensar, decidir).
- "goal": título de la meta a la que pertenece, si pertenece a una de las metas de abajo; si no, null.

METAS (algo que quiere lograr, no una sola acción: "aprobar el examen del jueves", "ir al gym 3 veces por semana", "lanzar mi app en marzo", "ahorrar 2000 €"):
- "title": corto, en su idioma.
- "type": "pronto" si tiene fecha en las próximas semanas, "semanal" si se repite cada semana, "largo" si es a largo plazo.
- "dueInDays": días hasta la fecha (null si no hay o es semanal).
- "perWeek": veces por semana para metas semanales ("3 veces" → 3), si no null.
- "steps": para "pronto" y "largo", de 2 a 6 pasos CONCRETOS y realistas para llegar (mismo formato que las tareas, con su "dueInDays" escalonado antes de la fecha). Para "semanal", [].
- "template": para "semanal", los datos de cada sesión si los dice: {"title","minutes","where","at","kind","sport","checklist"}; si no, {}.
Las tareas que pertenecen a una meta van en "steps" de esa meta, no en "tasks".

Si hay PERFIL, úsalo: "where" de la compra = su tienda favorita si no dice otra; "where" del gym = su gimnasio; las tareas de sus áreas importantes valen "importance" 3; para metas de salud o peso, ritmo seguro. Si el texto describe sus áreas (por ejemplo "Gimnasio (perWeek: 4)"), crea metas semanales con esa frecuencia.

- "tired": true si dice que está cansada o sin energía.
Si recibes una CAPTURA de mensajes o mails, extrae solo lo que la persona TIENE QUE HACER (peticiones, citas, fechas, lugares, horas).
Responde SOLO con JSON: {"tasks":[...],"goals":[...],"tired":boolean}`;

const WEEK = `
MODO SEMANA: la persona te cuenta lo que quiere hacer esta semana. Organízale la semana entera.
- Reparte las tareas en días: "dueInDays" = el día en que se HACE, según la TABLA DE DÍAS de abajo (0 = hoy… 6). Usa TODOS los días de la semana: equilibra (nada de 8 cosas un día y 0 otro) y no lo metas todo en hoy.
- Si dice desde qué día ("a partir del jueves", "desde el lunes"), NADA va antes de ese día.
- Si nombra un día ("el viernes", "el martes y el jueves"), usa exactamente ese número de la TABLA DE DÍAS.
- Lo que se repite ("gym 3 veces", "estudiar cada día", "lavar los platos todos los días") se convierte en VARIAS tareas, una por día, repartidas (gym 3 veces → 3 tareas en días distintos, separadas).
- Pon "at" ("HH:MM") a CADA tarea, dentro de su horario del PERFIL (se levanta / se acuesta, trabajo o clases), sin solapar, dejando huecos para comer. Lo difícil en sus horas de más energía. Lo que dice con hora fija (entreno de fútbol a las 19:00) se queda a esa hora.
- "importance": 3 para lo que dice que es prioridad o importante; el resto 2 o 1.
- Las tareas de casa (lavar los platos, hacer la comida) también llevan hora y duración realista.
- Según a qué se dedica (PERFIL):
  · Entrenador/a de gym o personal trainer: cada sesión con un cliente es una tarea con su hora ("Sesión con Marta", 60 min); añade antes un rato corto de preparar los programas y deja su propio entreno en algún hueco.
  · Entrenador/a de fútbol: entrenamientos y partido son tareas con hora; añade preparar la sesión (ejercicios, convocatoria) el día antes y revisar el partido después.
  · Freelance: bloques de trabajo por cliente o proyecto, más un rato de admin (facturas, emails) a la semana.
  · Emprendedor/a: lo que hace crecer el negocio (ventas, producto) en sus horas de más energía, lo operativo después.
  · Estudiante: bloques de estudio cortos repartidos antes de cada examen o entrega.
- "wake": si un día está muy lleno o la persona empieza muy tarde, propone una hora de levantarse ("07:00"); si no hace falta, null.
- "advice": 1 o 2 frases cortas, amables y concretas en su idioma, dirigidas a la persona (por ejemplo: "El martes tienes mucho: levántate a las 7 y haz el gym antes de clase").
Responde SOLO con JSON: {"tasks":[...],"goals":[...],"tired":boolean,"wake":string|null,"advice":string}`;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { text, today, weekday, lang, image, mediaType, profile, mode } = await req.json();
    const week = mode === 'week';
    const hasImage = typeof image === 'string' && image.length > 0;
    if (!hasImage && (typeof text !== 'string' || !text.trim())) {
        return Response.json({ error: 'text or image is required' }, { status: 400, headers: cors });
    }
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    const groqKey = Deno.env.get('GROQ_API_KEY');
    const choice = Deno.env.get('AI_PROVIDER');
    const provider = choice === 'groq' && groqKey ? 'groq'
      : choice === 'anthropic' && anthropicKey ? 'anthropic'
      : anthropicKey ? 'anthropic' : groqKey ? 'groq' : null;
    if (!provider) return Response.json({ error: 'no AI key set (GROQ_API_KEY or ANTHROPIC_API_KEY)' }, { status: 500, headers: cors });

    const dayName = typeof weekday === 'number' ? WEEKDAYS[weekday] : '';
    const perfil = typeof profile === 'string' && profile.trim() ? `\nPERFIL de la persona: ${profile.slice(0, 1200)}` : '';
    // A table of the next 7 days so "el jueves" or "a partir del lunes" land on the right day.
    let table = '';
    if (week && typeof weekday === 'number' && typeof today === 'string') {
      const base = new Date(`${today}T12:00:00Z`);
      table = '\nTABLA DE DÍAS (dueInDays): ' + Array.from({ length: 7 }, (_, i) => {
        const d = new Date(base.getTime() + i * 86_400_000);
        return `${i} = ${WEEKDAYS[(weekday + i) % 7]} ${d.getUTCDate()}`;
      }).join(', ') + '.';
    }
    const intro = `Hoy es ${dayName} ${today ?? ''}. Idioma del móvil: ${lang ?? 'es'}.${table}${perfil}`;
    const prompt = hasImage
      ? `${intro} Esta es una imagen: puede ser una captura de mis mensajes o mails, o una foto de mis notas, una libreta, una pizarra, un post-it, una lista de la nevera, un ticket, una carta o un papel del colegio. Lee todo el texto (también a mano) y dime qué tengo que hacer, con fechas, horas y lugares si aparecen. Si una fecha (un partido, un concierto, una cita, un ticket) ya pasó antes de hoy, NO es una tarea: ignórala. Una lista de compra va como una sola tarea con la lista. Responde en JSON.`
      : `${intro}\n\nLo que tengo en la cabeza:\n${String(text).slice(0, 4000)}`;
    const type = typeof mediaType === 'string' ? mediaType : 'image/jpeg';

    let raw = '{}';
    if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': anthropicKey!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: week ? 2600 : 1800,
          system: week ? SYSTEM + WEEK : SYSTEM,
          messages: [{ role: 'user', content: hasImage
            ? [
                { type: 'image', source: { type: 'base64', media_type: type, data: image } },
                { type: 'text', text: prompt },
              ]
            : prompt }],
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        console.error('anthropic error', res.status, detail);
        return Response.json({ error: 'ai_failed', status: res.status, detail: detail.slice(0, 300) }, { status: 502, headers: cors });
      }
      const data = await res.json();
      raw = data?.content?.find((c: { type: string }) => c.type === 'text')?.text ?? '{}';
    } else {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${groqKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: GROQ_MODEL,
          temperature: 0.2,
          // Groq's free plan counts prompt + max output against ~6000 tokens a minute: keep the ceiling realistic.
          max_completion_tokens: week ? 2600 : 1800,
          response_format: { type: 'json_object' },
          // Qwen on Groq: answer directly, no thinking tokens (faster and cheaper on the free quota).
          ...(GROQ_MODEL.startsWith('qwen/') ? { reasoning_effort: 'none', reasoning_format: 'hidden' } : {}),
          messages: [
            { role: 'system', content: week ? SYSTEM + WEEK : SYSTEM },
            { role: 'user', content: hasImage
              ? [
                  { type: 'text', text: prompt },
                  { type: 'image_url', image_url: { url: `data:${type};base64,${image}` } },
                ]
              : prompt },
          ],
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        console.error('groq error', res.status, detail);
        return Response.json({ error: 'ai_failed', status: res.status, detail: detail.slice(0, 300) }, { status: 502, headers: cors });
      }
      const data = await res.json();
      raw = data?.choices?.[0]?.message?.content ?? '{}';
    }
    const json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
    return Response.json(
      {
        tasks: Array.isArray(json.tasks) ? json.tasks : [],
        goals: Array.isArray(json.goals) ? json.goals : [],
        tired: Boolean(json.tired),
        ...(week ? { wake: typeof json.wake === 'string' ? json.wake : null, advice: typeof json.advice === 'string' ? json.advice : '' } : {}),
      },
      { headers: cors },
    );
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'bad_request', detail: String(e).slice(0, 300) }, { status: 400, headers: cors });
  }
});
