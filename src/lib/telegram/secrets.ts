/*
 * Comparing a secret that arrived over the network with the one configured.
 *
 * Constant in the length of the configured secret, so a caller cannot learn
 * how many leading characters they got right by timing the answer. A plain
 * `===` stops at the first difference, and that difference is measurable.
 */
export const sameSecret = (presented: string | null | undefined, expected: string): boolean => {
  if (typeof presented !== "string" || expected.length === 0) return false;

  const a = new TextEncoder().encode(presented);
  const b = new TextEncoder().encode(expected);

  let difference = a.length ^ b.length;
  for (let i = 0; i < b.length; i += 1) {
    difference |= (a[i % a.length] ?? 0) ^ (b[i] ?? 0);
  }

  return difference === 0;
};
