export const REVIEW_KEY = 'zijijing-review-v1';
export function knownCharacters(characters, ids) {
  const known = new Set(Array.isArray(ids) ? ids : []);
  return characters.filter(c => known.has(c.id));
}
export function drawRound(pool, count = 5, random = Math.random) {
  const copy = [...new Map(pool.map(c => [c.id, c])).values()];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}
export function needsPractice(result) {
  return result.reading !== true || result.writing !== true;
}
