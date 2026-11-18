import { lang } from '../i18n';
import type { Task } from './types';

/**
 * Shopping: a task becomes a shopping list grouped by aisle, with quantities.
 * GetGo doesn't have each chain's live catalogue (no public API), so it uses a catalogue of everyday products
 * in the order you walk through most supermarkets. Anything else can be typed.
 */
export type Aisle = 'fruta' | 'lacteos' | 'carne' | 'pan' | 'despensa' | 'congelados' | 'bebidas' | 'higiene' | 'limpieza' | 'otros';
export const AISLES: Aisle[] = ['fruta', 'lacteos', 'carne', 'pan', 'despensa', 'congelados', 'bebidas', 'higiene', 'limpieza', 'otros'];

// [aisle, es, en, fr, nl, de, pt, it]
const P: [Aisle, string, string, string, string, string, string, string][] = [
  ['fruta', 'Manzanas', 'Apples', 'Pommes', 'Appels', 'Äpfel', 'Maçãs', 'Mele'],
  ['fruta', 'Plátanos', 'Bananas', 'Bananes', 'Bananen', 'Bananen', 'Bananas', 'Banane'],
  ['fruta', 'Naranjas', 'Oranges', 'Oranges', 'Sinaasappels', 'Orangen', 'Laranjas', 'Arance'],
  ['fruta', 'Fresas', 'Strawberries', 'Fraises', 'Aardbeien', 'Erdbeeren', 'Morangos', 'Fragole'],
  ['fruta', 'Aguacates', 'Avocados', 'Avocats', 'Avocado’s', 'Avocados', 'Abacates', 'Avocado'],
  ['fruta', 'Tomates', 'Tomatoes', 'Tomates', 'Tomaten', 'Tomaten', 'Tomates', 'Pomodori'],
  ['fruta', 'Lechuga', 'Lettuce', 'Salade', 'Sla', 'Salat', 'Alface', 'Insalata'],
  ['fruta', 'Espinacas', 'Spinach', 'Épinards', 'Spinazie', 'Spinat', 'Espinafres', 'Spinaci'],
  ['fruta', 'Brócoli', 'Broccoli', 'Brocoli', 'Broccoli', 'Brokkoli', 'Brócolos', 'Broccoli'],
  ['fruta', 'Zanahorias', 'Carrots', 'Carottes', 'Wortelen', 'Karotten', 'Cenouras', 'Carote'],
  ['fruta', 'Cebollas', 'Onions', 'Oignons', 'Uien', 'Zwiebeln', 'Cebolas', 'Cipolle'],
  ['fruta', 'Patatas', 'Potatoes', 'Pommes de terre', 'Aardappelen', 'Kartoffeln', 'Batatas', 'Patate'],
  ['lacteos', 'Huevos', 'Eggs', 'Œufs', 'Eieren', 'Eier', 'Ovos', 'Uova'],
  ['lacteos', 'Leche', 'Milk', 'Lait', 'Melk', 'Milch', 'Leite', 'Latte'],
  ['lacteos', 'Yogur', 'Yogurt', 'Yaourt', 'Yoghurt', 'Joghurt', 'Iogurte', 'Yogurt'],
  ['lacteos', 'Queso', 'Cheese', 'Fromage', 'Kaas', 'Käse', 'Queijo', 'Formaggio'],
  ['lacteos', 'Mantequilla', 'Butter', 'Beurre', 'Boter', 'Butter', 'Manteiga', 'Burro'],
  ['lacteos', 'Skyr', 'Skyr', 'Skyr', 'Skyr', 'Skyr', 'Skyr', 'Skyr'],
  ['carne', 'Pollo', 'Chicken', 'Poulet', 'Kip', 'Hähnchen', 'Frango', 'Pollo'],
  ['carne', 'Carne picada', 'Minced meat', 'Viande hachée', 'Gehakt', 'Hackfleisch', 'Carne picada', 'Carne macinata'],
  ['carne', 'Salmón', 'Salmon', 'Saumon', 'Zalm', 'Lachs', 'Salmão', 'Salmone'],
  ['carne', 'Atún', 'Tuna', 'Thon', 'Tonijn', 'Thunfisch', 'Atum', 'Tonno'],
  ['carne', 'Jamón', 'Ham', 'Jambon', 'Ham', 'Schinken', 'Fiambre', 'Prosciutto'],
  ['pan', 'Pan', 'Bread', 'Pain', 'Brood', 'Brot', 'Pão', 'Pane'],
  ['pan', 'Tortillas', 'Wraps', 'Wraps', 'Wraps', 'Wraps', 'Tortilhas', 'Piadine'],
  ['despensa', 'Arroz', 'Rice', 'Riz', 'Rijst', 'Reis', 'Arroz', 'Riso'],
  ['despensa', 'Pasta', 'Pasta', 'Pâtes', 'Pasta', 'Nudeln', 'Massa', 'Pasta'],
  ['despensa', 'Avena', 'Oats', 'Flocons d’avoine', 'Havermout', 'Haferflocken', 'Aveia', 'Avena'],
  ['despensa', 'Aceite de oliva', 'Olive oil', 'Huile d’olive', 'Olijfolie', 'Olivenöl', 'Azeite', 'Olio d’oliva'],
  ['despensa', 'Garbanzos', 'Chickpeas', 'Pois chiches', 'Kikkererwten', 'Kichererbsen', 'Grão', 'Ceci'],
  ['despensa', 'Café', 'Coffee', 'Café', 'Koffie', 'Kaffee', 'Café', 'Caffè'],
  ['despensa', 'Frutos secos', 'Nuts', 'Noix', 'Noten', 'Nüsse', 'Frutos secos', 'Frutta secca'],
  ['despensa', 'Proteína en polvo', 'Protein powder', 'Protéine en poudre', 'Eiwitpoeder', 'Proteinpulver', 'Proteína em pó', 'Proteine in polvere'],
  ['congelados', 'Verduras congeladas', 'Frozen vegetables', 'Légumes surgelés', 'Diepvriesgroenten', 'TK-Gemüse', 'Legumes congelados', 'Verdure surgelate'],
  ['congelados', 'Fruta congelada', 'Frozen fruit', 'Fruits surgelés', 'Diepvriesfruit', 'TK-Obst', 'Fruta congelada', 'Frutta surgelata'],
  ['bebidas', 'Agua', 'Water', 'Eau', 'Water', 'Wasser', 'Água', 'Acqua'],
  ['bebidas', 'Zumo', 'Juice', 'Jus', 'Sap', 'Saft', 'Sumo', 'Succo'],
  ['higiene', 'Papel higiénico', 'Toilet paper', 'Papier toilette', 'Wc-papier', 'Toilettenpapier', 'Papel higiénico', 'Carta igienica'],
  ['higiene', 'Champú', 'Shampoo', 'Shampoing', 'Shampoo', 'Shampoo', 'Champô', 'Shampoo'],
  ['higiene', 'Pasta de dientes', 'Toothpaste', 'Dentifrice', 'Tandpasta', 'Zahnpasta', 'Pasta de dentes', 'Dentifricio'],
  ['limpieza', 'Detergente', 'Laundry detergent', 'Lessive', 'Wasmiddel', 'Waschmittel', 'Detergente', 'Detersivo'],
  ['limpieza', 'Lavavajillas', 'Dish soap', 'Liquide vaisselle', 'Afwasmiddel', 'Spülmittel', 'Detergente da loiça', 'Detersivo piatti'],
  ['limpieza', 'Bolsas de basura', 'Bin bags', 'Sacs poubelle', 'Vuilniszakken', 'Müllbeutel', 'Sacos do lixo', 'Sacchi spazzatura'],
];
const COL: Record<string, number> = { es: 1, en: 2, fr: 3, nl: 4, de: 5, pt: 6, it: 7 };

export type Product = { aisle: Aisle; name: string; all: string[] };
export const CATALOG: Product[] = P.map((row) => ({ aisle: row[0], name: row[COL[lang] ?? 2] as string, all: row.slice(1) as string[] }));

/** Which aisle a typed item belongs to (in any language); unknown → "otros". */
export function aisleOf(text: string): Aisle {
  const s = splitQty(text).name.toLowerCase();
  const hit = CATALOG.find((p) => p.all.some((n) => s.includes(n.toLowerCase()) || n.toLowerCase().includes(s)));
  return hit?.aisle ?? 'otros';
}

/** "Huevos · 12" ⇄ { name: 'Huevos', qty: 12 } */
export function splitQty(text: string): { name: string; qty: number } {
  const m = /^(.*?)\s*[·x×]\s*(\d+)$/.exec(text.trim());
  return m ? { name: m[1].trim(), qty: Number(m[2]) } : { name: text.trim(), qty: 1 };
}
export const joinQty = (name: string, qty: number) => (qty > 1 ? `${name} · ${qty}` : name);

const SHOP_WORDS = ['compra', 'súper', 'super', 'supermercado', 'groceries', 'shopping', 'courses', 'boodschappen', 'einkauf', 'einkaufen', 'compras', 'spesa'];
export function isShopping(task: Pick<Task, 'title' | 'kind'>) {
  const s = task.title.toLowerCase();
  return SHOP_WORDS.some((w) => s.includes(w));
}
