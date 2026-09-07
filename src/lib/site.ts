export const readerLanguages = ["en", "fi", "sv"] as const;
export type ReaderLanguage = (typeof readerLanguages)[number];

export const readerTranslations = {
  en: {
    allIssues: "← All issues",
    allIssuesLabel: "All issues",
    articles: "Articles",
    article: "Article",
    backToContents: "Back to contents",
    contents: "Contents",
    cover: "Cover",
    footnotes: "Footnotes",
    language: "Language",
    navigation: "Page navigation",
    next: "Next",
    nextArticle: "Next article",
    nextPage: "Next page",
    page: "Page",
    pages: "Pages",
    previous: "Previous",
    previousArticle: "Previous article",
    previousPage: "Previous page",
    readingProgress: "Reading progress",
    view: "View",
    viewMode: "Reading view",
    settings: "Settings",
    close: "Close",
  },
  fi: {
    allIssues: "← Kaikki numerot",
    allIssuesLabel: "Kaikki numerot",
    articles: "Artikkelit",
    article: "Artikkeli",
    backToContents: "Takaisin sisällysluetteloon",
    contents: "Sisällys",
    cover: "Kansi",
    footnotes: "Alaviitteet",
    language: "Kieli",
    navigation: "Sivunavigaatio",
    next: "Seuraava",
    nextArticle: "Seuraava artikkeli",
    nextPage: "Seuraava sivu",
    page: "Sivu",
    pages: "Sivut",
    previous: "Edellinen",
    previousArticle: "Edellinen artikkeli",
    previousPage: "Edellinen sivu",
    readingProgress: "Lukemisen edistyminen",
    view: "Näkymä",
    viewMode: "Lukunäkymä",
    settings: "Asetukset",
    close: "Sulje",
  },
  sv: {
    allIssues: "← Alla nummer",
    allIssuesLabel: "Alla nummer",
    articles: "Artiklar",
    article: "Artikel",
    backToContents: "Tillbaka till innehållsförteckningen",
    contents: "Innehåll",
    cover: "Omslag",
    footnotes: "Fotnoter",
    language: "Språk",
    navigation: "Sidnavigation",
    next: "Nästa",
    nextArticle: "Nästa artikel",
    nextPage: "Nästa sida",
    page: "Sida",
    pages: "Sidor",
    previous: "Föregående",
    previousArticle: "Föregående artikel",
    previousPage: "Föregående sida",
    readingProgress: "Läsförlopp",
    view: "Vy",
    viewMode: "Läsvy",
    settings: "Inställningar",
    close: "Stäng",
  },
} as const;

export type ReaderTranslationKey = keyof (typeof readerTranslations)["en"];

export const site = {
  name: "Magazine",
  description: "A responsive, typeset web magazine.",
  locale: "en-GB",
  reader: { defaultLanguage: "en" as ReaderLanguage, languages: readerLanguages },
};

export const readerLanguageNames: Record<ReaderLanguage, string> = {
  en: "English",
  fi: "Suomi",
  sv: "Svenska",
};

export function resolveReaderLanguage(value: string | undefined): ReaderLanguage {
  const language = value?.toLowerCase().split("-")[0] as ReaderLanguage | undefined;
  return language && readerLanguages.includes(language) ? language : site.reader.defaultLanguage;
}

export function preferredReaderLanguage(values: readonly string[]): ReaderLanguage | undefined {
  for (const value of values) {
    const language = value.toLowerCase().split("-")[0] as ReaderLanguage;
    if (readerLanguages.includes(language)) return language;
  }
}

export function readerText(language: ReaderLanguage, key: ReaderTranslationKey): string {
  return readerTranslations[language][key];
}
