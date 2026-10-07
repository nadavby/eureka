import i18n, { directionOf } from "@/lib/i18n";
import en from "@/locales/en.json";
import he from "@/locales/he.json";

type Tree = { [key: string]: string | Tree };
const keys = (tree: Tree, prefix = ""): string[] =>
  Object.entries(tree).flatMap(([k, v]) => (typeof v === "string" ? [prefix + k] : keys(v, `${prefix}${k}.`)));
// Plural forms differ per language (Hebrew has a "two" form), so compare the base keys.
const PLURAL = /_(zero|one|two|few|many|other)$/;
const baseKeys = (tree: Tree) => [...new Set(keys(tree).map((k) => k.replace(PLURAL, "")))].sort();

describe("i18n", () => {
  it("has a Hebrew string for every English key, and nothing extra", () => {
    expect(baseKeys(he as Tree)).toEqual(baseKeys(en as Tree));
  });

  it("keeps the same {{placeholders}} in both languages", () => {
    const placeholders = (s: string) => (s.match(/{{\s*\w+\s*}}/g) ?? []).sort();
    const heFlat = Object.fromEntries(keys(he as Tree).map((k) => [k, i18n.getFixedT("he")(k)]));
    for (const key of keys(en as Tree).filter((k) => !PLURAL.test(k))) {
      expect([key, placeholders(heFlat[key])]).toEqual([key, placeholders(i18n.getFixedT("en")(key))]);
    }
  });

  it("switches the document direction with the language", async () => {
    expect(directionOf("he")).toBe("rtl");
    expect(directionOf("en-US")).toBe("ltr");
    await i18n.changeLanguage("he");
    expect(document.documentElement.dir).toBe("rtl");
    expect(document.documentElement.lang).toBe("he");
    await i18n.changeLanguage("en");
    expect(document.documentElement.dir).toBe("ltr");
  });
});
