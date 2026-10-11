/** One rendered face plus one physical back for every additional card.
 * Stack offsets are compressed for large inventories without displaying a number.
 * Keep all the cards; no fake capped stacks. */
export function stackBackCount(count) {
  const n=Number(count);
  return Number.isSafeInteger(n) && n>0 ? n-1 : 0;
}
export function stackSpacing(count) {
  const n=Math.max(1,Number(count)||1);
  return Math.min(4,28/n);
}
