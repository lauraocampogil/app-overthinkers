import type { Kind } from './types';

/**
 * The person's profile, filled in the onboarding. Every automatic decision reads from it:
 * which 3 areas of life matter most (priorities), where things happen (stores, gym), the day window, energy.
 */
export type AreaId =
  | 'trabajo'
  | 'estudios'
  | 'gimnasio'
  | 'deporte'
  | 'comer_bien'
  | 'musculo'
  | 'bajar_peso'
  | 'dormir'
  | 'casa_compras'
  | 'dinero'
  | 'familia'
  | 'amigos'
  | 'salud_mental'
  | 'proyecto'
  | 'contenido'
  | 'otra';

export type Area = { id: AreaId; label?: string; answers: Record<string, string | string[]> };

export const ROLES = ['estudiante', 'empleado', 'freelance', 'emprendedor', 'coachGym', 'coachFutbol', 'deportista', 'otro'] as const;
export type Role = (typeof ROLES)[number];
const ROLE_ES: Record<Role, string> = {
  estudiante: 'estudiante',
  empleado: 'trabaja por cuenta ajena',
  freelance: 'freelance (trabaja con clientes y proyectos)',
  emprendedor: 'emprendedor/a (lleva su propio negocio)',
  coachGym: 'entrenador/a de gimnasio o personal trainer (sesiones con clientes)',
  coachFutbol: 'entrenador/a de fútbol (entrenamientos y partidos con su equipo)',
  deportista: 'deportista',
  otro: '',
};

export type Profile = {
  onboarded: boolean;
  /** Ordered: the first one weighs most. */
  areas: Area[];
  country: string;
  stores: string[];
  favoriteStore: string | null;
  wake: string;
  sleep: string;
  /** Days with work or classes (0 = Sunday … 6 = Saturday) and the hours. */
  workDays: number[];
  workFrom: string | null;
  workTo: string | null;
  energy: 'manana' | 'tarde' | 'noche' | null;
  struggles: string[];
  /** What the person does: shapes how the week is planned (coach sessions, client work, study…). */
  role?: Role | null;
  /** The fixed week: things that repeat every week and almost never change (training, classes, gym). */
  fixed: FixedItem[];
  /** Where the person lives, to count travel time to tasks with a place (see lib/trayecto). */
  home?: { address: string; lat: number; lng: number } | null;
  /** Where they work or study, for the trip on work days. */
  workPlace?: { address: string; lat: number; lng: number } | null;
  /** How they usually move. */
  transport?: 'pie' | 'bici' | 'transporte' | 'coche';
};

/**
 * One thing of the fixed week. days: 0 = Sunday … 6 = Saturday.
 * By default it is part of the person's life (a class, work, training): it sits in the calendar as busy time,
 * never as a task to tick. `task: true` makes it a task too ("Llegar a la hora al trabajo").
 */
export type FixedItem = { id: string; text: string; days: number[]; at: string | null; minutes: number | null; where?: string | null; kind?: Kind; task?: boolean };

export const EMPTY_PROFILE: Profile = {
  onboarded: false,
  areas: [],
  country: '',
  stores: [],
  favoriteStore: null,
  wake: '07:30',
  sleep: '23:00',
  workDays: [1, 2, 3, 4, 5],
  workFrom: null,
  workTo: null,
  energy: null,
  struggles: [],
  fixed: [],
};

export type Question = { id: string; type: 'text' | 'chips' | 'multi' | 'days'; options?: string[] };

/** The catalogue of areas: which kinds of task and words belong to each, and the 1–2 questions that make it concrete. */
export const AREAS: Record<AreaId, { kinds: Kind[]; words: string[]; questions: Question[] }> = {
  trabajo: { kinds: ['trabajo'], words: ['trabajo', 'cliente', 'reunión', 'mail', 'informe', 'jefe', 'work'], questions: [{ id: 'what', type: 'text' }] },
  estudios: {
    kinds: ['estudio'],
    words: ['estudiar', 'examen', 'clase', 'apuntes', 'trabajo de', 'tfg', 'study', 'exam'],
    questions: [{ id: 'what', type: 'text' }, { id: 'exams', type: 'chips', options: ['no', 'month', 'later'] }],
  },
  gimnasio: {
    kinds: ['deporte'],
    words: ['gym', 'gimnasio', 'pesas', 'entreno', 'piernas', 'espalda', 'pecho'],
    questions: [{ id: 'where', type: 'text' }, { id: 'perWeek', type: 'chips', options: ['2', '3', '4', '5', '6'] }],
  },
  deporte: {
    kinds: ['deporte'],
    words: ['entreno', 'partido', 'correr', 'fútbol', 'futbol', 'pádel', 'padel', 'nadar', 'yoga', 'baloncesto'],
    questions: [{ id: 'sport', type: 'chips', options: ['futbol', 'correr', 'padel', 'baloncesto', 'natacion', 'yoga', 'otro'] }, { id: 'days', type: 'days' }],
  },
  comer_bien: {
    kinds: ['casa'],
    words: ['comida', 'cocinar', 'cena', 'desayuno', 'meal', 'verdura', 'preparar'],
    questions: [{ id: 'hard', type: 'multi', options: ['cook', 'time', 'snack', 'plan'] }],
  },
  musculo: { kinds: ['deporte'], words: ['fuerza', 'músculo', 'musculo', 'proteína', 'proteina', 'pesas'], questions: [{ id: 'perWeek', type: 'chips', options: ['2', '3', '4', '5'] }] },
  bajar_peso: { kinds: ['deporte', 'casa'], words: ['caminar', 'correr', 'dieta', 'peso', 'kilos', 'verdura', 'cardio'], questions: [{ id: 'goal', type: 'text' }] },
  dormir: { kinds: ['otro'], words: ['dormir', 'acostarme', 'pantallas', 'sueño'], questions: [] },
  casa_compras: { kinds: ['casa'], words: ['compra', 'comprar', 'limpiar', 'lavar', 'ropa', 'casa', 'super'], questions: [] },
  dinero: { kinds: ['otro'], words: ['pagar', 'factura', 'ahorrar', 'banco', 'presupuesto', 'gastos'], questions: [{ id: 'want', type: 'chips', options: ['save', 'track', 'earn'] }] },
  familia: { kinds: ['otro'], words: ['mamá', 'mama', 'papá', 'papa', 'familia', 'pareja', 'hermana', 'hermano', 'abuela'], questions: [] },
  amigos: { kinds: ['otro'], words: ['amigos', 'amiga', 'amigo', 'quedar', 'cumple'], questions: [] },
  salud_mental: { kinds: ['otro'], words: ['meditar', 'terapia', 'respirar', 'diario', 'descansar', 'paseo'], questions: [] },
  proyecto: { kinds: ['trabajo'], words: ['proyecto', 'app', 'web', 'negocio', 'diseño', 'lanzar'], questions: [{ id: 'what', type: 'text' }] },
  contenido: { kinds: ['trabajo'], words: ['vídeo', 'video', 'post', 'reel', 'tiktok', 'instagram', 'grabar', 'editar'], questions: [{ id: 'what', type: 'text' }] },
  otra: { kinds: ['otro'], words: [], questions: [] },
};

export const AREA_ORDER: AreaId[] = [
  'trabajo', 'estudios', 'gimnasio', 'deporte', 'comer_bien', 'musculo', 'bajar_peso', 'dormir',
  'casa_compras', 'dinero', 'familia', 'amigos', 'salud_mental', 'proyecto', 'contenido', 'otra',
];

/** Supermarket chains per country (ISO code). "Otra" is always possible as free text. */
export const STORES: Record<string, string[]> = {
  BE: ['Delhaize', 'Colruyt', 'Lidl', 'Aldi', 'Albert Heijn', 'Carrefour', 'Intermarché'],
  NL: ['Albert Heijn', 'Jumbo', 'Lidl', 'Aldi', 'Plus', 'Dirk'],
  FR: ['Carrefour', 'E.Leclerc', 'Auchan', 'Intermarché', 'Lidl', 'Monoprix', 'Super U'],
  ES: ['Mercadona', 'Carrefour', 'Lidl', 'Dia', 'Alcampo', 'Eroski', 'Consum'],
  DE: ['Edeka', 'Rewe', 'Aldi', 'Lidl', 'Kaufland', 'Penny', 'Netto'],
  PT: ['Continente', 'Pingo Doce', 'Lidl', 'Auchan', 'Intermarché', 'Minipreço'],
  IT: ['Esselunga', 'Coop', 'Conad', 'Carrefour', 'Lidl', 'Eurospin'],
  GB: ['Tesco', "Sainsbury's", 'Asda', 'Aldi', 'Lidl', 'Morrisons', 'Waitrose'],
  US: ['Walmart', 'Target', 'Kroger', 'Costco', 'Whole Foods', "Trader Joe's", 'Aldi'],
  MX: ['Walmart', 'Soriana', 'Chedraui', 'La Comer', 'Costco', 'Bodega Aurrera'],
  CO: ['Éxito', 'Carulla', 'Jumbo', 'Olímpica', 'D1', 'Ara'],
  AR: ['Carrefour', 'Coto', 'Día', 'Jumbo', 'Disco', 'Changomás'],
};
export const COUNTRIES = Object.keys(STORES);

/** How much a task belongs to the person's areas: 3 for the first area, 2 for the second, 1 for the third. */
export function areaWeight(task: { title: string; kind: Kind }, areas: Area[]): number {
  const title = task.title.toLowerCase();
  let best = 0;
  areas.slice(0, 3).forEach((a, i) => {
    const def = AREAS[a.id];
    const label = (a.label ?? '').toLowerCase();
    const hit = def.words.some((w) => title.includes(w)) || (label && title.includes(label)) || (def.kinds.includes(task.kind) && task.kind !== 'otro');
    if (hit) best = Math.max(best, 3 - i);
  });
  return best;
}

/** Which of the person's areas a task belongs to (index in `areas`), or -1. */
export function areaIndex(task: { title: string; kind: Kind }, areas: Area[]): number {
  const title = task.title.toLowerCase();
  return areas.slice(0, 3).findIndex((a) => {
    const def = AREAS[a.id];
    const label = (a.label ?? '').toLowerCase();
    return def.words.some((w) => title.includes(w)) || (label && title.includes(label)) || (def.kinds.includes(task.kind) && task.kind !== 'otro');
  });
}

export const AREA_ES: Record<AreaId, string> = {
  trabajo: 'Trabajo', estudios: 'Estudios', gimnasio: 'Gimnasio', deporte: 'Deporte', comer_bien: 'Comer bien',
  musculo: 'Coger músculo', bajar_peso: 'Bajar de peso', dormir: 'Dormir mejor', casa_compras: 'Casa y compras',
  dinero: 'Dinero', familia: 'Familia y pareja', amigos: 'Amigos', salud_mental: 'Salud mental',
  proyecto: 'Proyecto propio', contenido: 'Crear contenido', otra: 'Otra',
};

/** Short description of the person for the AI (always in Spanish: it is the prompt's language). */
export function profileContext(p: Profile): string {
  if (!p.onboarded && !p.areas.length) return '';
  const areas = p.areas
    .map((a, i) => {
      const details = Object.entries(a.answers)
        .filter(([, v]) => (Array.isArray(v) ? v.length : String(v).trim()))
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
        .join('; ');
      return `${i + 1}. ${a.label || AREA_ES[a.id]}${details ? ` (${details})` : ''}`;
    })
    .join(' ');
  const lines = [
    p.role && ROLE_ES[p.role] ? `A qué se dedica: ${ROLE_ES[p.role]}.` : '',
    areas ? `Lo más importante para la persona, por orden: ${areas}.` : '',
    p.favoriteStore ? `Hace la compra en ${p.favoriteStore}${p.stores.length > 1 ? ` (también ${p.stores.filter((s) => s !== p.favoriteStore).join(', ')})` : ''}.` : '',
    `Se levanta a las ${p.wake} y se acuesta a las ${p.sleep}.`,
    p.workFrom && p.workTo ? `Trabaja o estudia de ${p.workFrom} a ${p.workTo} (días ${p.workDays.join(',')}, 0 = domingo).` : '',
    p.energy ? `Tiene más energía por la ${p.energy === 'manana' ? 'mañana' : p.energy}.` : '',
    p.country ? `País: ${p.country}.` : '',
    p.transport ? `Se mueve sobre todo ${p.transport === 'pie' ? 'a pie' : p.transport === 'bici' ? 'en bici' : p.transport === 'coche' ? 'en coche' : 'en transporte público'}; Okio cuenta el trayecto antes de cada cosa con lugar.` : '',
    p.fixed?.length
      ? `Su semana fija (ya está en su horario, no la vuelvas a crear, planifica alrededor): ${p.fixed
          .map((f) => `${f.text} (días ${f.days.join(',')}${f.at ? `, ${f.at}` : ''}${f.minutes ? `, ${f.minutes} min` : ''}${f.where ? `, en ${f.where}` : ''})`)
          .join('; ')}.`
      : '',
  ];
  return lines.filter(Boolean).join(' ');
}

const STOP = new Set(['para', 'de', 'del', 'la', 'el', 'los', 'las', 'a', 'al', 'en', 'mi', 'mis', 'por', 'con', 'y', 'un', 'una', 'the', 'to', 'by', 'for', 'my', 'of', 'and', 'in', 'pour', 'le', 'les', 'du', 'des', 'et', 'van', 'het', 'een', 'voor', 'und', 'die', 'der', 'das', 'zu', 'bis', 'o', 'do', 'da', 'il', 'per', 'di']);
const tokens = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\d+/g, ' ')
    .split(/[^a-z]+/)
    .filter((w) => w.length > 1 && !STOP.has(w));

/** Two goals that mean the same thing ("Bajar 3 kg para diciembre" / "Bajar 5kg para finales de diciembre"). */
export function sameGoal(a: string, b: string) {
  const x = new Set(tokens(a));
  const y = new Set(tokens(b));
  if (!x.size || !y.size) return a.trim().toLowerCase() === b.trim().toLowerCase();
  const inter = [...x].filter((w) => y.has(w)).length;
  return inter / Math.min(x.size, y.size) >= 0.75 && inter / Math.max(x.size, y.size) >= 0.5;
}
