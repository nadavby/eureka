/** The short number printed on a claim tag: the last 6 hex digits of the item id. */
export const tagNumber = (id: string) => `#${id.slice(-6).toUpperCase()}`;
