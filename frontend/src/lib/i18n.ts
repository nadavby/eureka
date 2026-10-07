import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import en from "@/locales/en.json";
import he from "@/locales/he.json";

export const LANGUAGES = [
  { code: "en", label: "English", dir: "ltr" },
  { code: "he", label: "עברית", dir: "rtl" },
] as const;
export type Language = (typeof LANGUAGES)[number]["code"];

export const directionOf = (lng: string): "ltr" | "rtl" => (lng.startsWith("he") ? "rtl" : "ltr");

/** Keeps <html lang> and <html dir> in sync, so the whole layout (logical properties) flips for Hebrew. */
const applyDocumentLanguage = (lng: string) => {
  document.documentElement.lang = lng;
  document.documentElement.dir = directionOf(lng);
};

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, he: { translation: he } },
    fallbackLng: "en",
    supportedLngs: ["en", "he"],
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: { order: ["localStorage", "navigator"], lookupLocalStorage: "lang", caches: ["localStorage"] },
  });

applyDocumentLanguage(i18n.resolvedLanguage ?? "en");
i18n.on("languageChanged", applyDocumentLanguage);

export default i18n;
