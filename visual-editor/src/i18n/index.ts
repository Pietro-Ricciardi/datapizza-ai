import { useMemo } from "react";
import { availableLocales, defaultLocale, getTranslations, type Locale } from "./resources";

export { availableLocales, defaultLocale } from "./resources";
export type { Locale } from "./resources";

export function useTranslations(locale: Locale) {
  return useMemo(() => getTranslations(locale), [locale]);
}

export function normalizeLocale(candidate: string | null | undefined): Locale {
  if (!candidate) {
    return defaultLocale;
  }
  const normalized = candidate.toLowerCase();
  if ((availableLocales as readonly string[]).includes(normalized)) {
    return normalized as Locale;
  }
  return defaultLocale;
}
