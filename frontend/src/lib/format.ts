/**
 * The number printed on a claim tag: 6 hex digits from a hash of the item id.
 * Hashing (instead of the id's last digits) keeps numbers of items created together from
 * looking sequential, while staying stable for the same item.
 */
export const tagNumber = (id: string) => {
  let h = 0x811c9dc5; // FNV-1a, 32-bit
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `#${((h >>> 0) & 0xffffff).toString(16).toUpperCase().padStart(6, "0")}`;
};
