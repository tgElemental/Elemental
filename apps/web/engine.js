/**
 * Elemental rules v2 / pure, deterministic core shared by Worker and practice mode.
 * A result is derived by the server from a server-picked opponent; clients cannot
 * submit opponents, earned points, weather or rewards.
 */
export const ELEMENTS = Object.freeze(['water', 'fire', 'earth', 'wind']);
export const BEATS = Object.freeze({water:'fire', fire:'earth', earth:'wind', wind:'water'});
export const ELEMENT_LABELS = Object.freeze({water:'آب', fire:'آتش', earth:'خاک', wind:'باد'});
export const ELEMENT_SIGNS = Object.freeze({water:'◈', fire:'✦', earth:'⬡', wind:'〰'});
export const WEATHERS = Object.freeze([
  {key:'spring', title:'باران بهاری', element:'water', text:'آب در این چرخه نیرو می‌گیرد.'},
  {key:'ember', title:'شهاب آتشین', element:'fire', text:'آتش در این چرخه نیرو می‌گیرد.'},
  {key:'roots', title:'بیداری زمین', element:'earth', text:'خاک در این چرخه نیرو می‌گیرد.'},
  {key:'breeze', title:'بادهای مهاجر', element:'wind', text:'باد در این چرخه نیرو می‌گیرد.'},
  {key:'eclipse', title:'کسوف', element:null, text:'امروز نیروها متعادل‌اند؛ جوایز برخورد همچنان پابرجاست.'},
]);

/** Rotating daily conditions. UTC gives all players the same world event. */
export function worldForDay(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day + 'T00:00:00Z'))) throw new Error('Invalid day');
  const n = Math.floor(Date.parse(day + 'T00:00:00Z') / 86400000);
  return WEATHERS[((n % WEATHERS.length) + WEATHERS.length) % WEATHERS.length];
}
export function weekForDay(day) {
  const date = new Date(day + 'T00:00:00Z');
  if (Number.isNaN(date.getTime())) throw new Error('Invalid day');
  const dow = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dow);
  return date.toISOString().slice(0,10);
}

/** Old win cycle + the old fire/wind & water/earth synthesis, modern daily affinity. */
export function resolveRound(pick, rival, weather) {
  if (!ELEMENTS.includes(pick) || !ELEMENTS.includes(rival)) throw new Error('Invalid element');
  if (!WEATHERS.some(w => w.key === weather.key)) throw new Error('Invalid weather');
  const outcome = pick === rival ? 'draw' : BEATS[pick] === rival ? 'win' : 'loss';
  const tree = [pick, rival].includes('water') && [pick, rival].includes('earth') ? 1 : 0;
  const light = [pick, rival].includes('fire') && [pick, rival].includes('wind') ? 1 : 0;
  const affinity = outcome === 'win' && weather.element === pick ? 1 : 0;
  const basePoints = (outcome === 'win' ? 3 : outcome === 'draw' ? 1 : 0) + affinity;
  return {pick, rival, outcome, tree, light, affinity, basePoints};
}
