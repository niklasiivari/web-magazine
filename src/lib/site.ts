export const readerLanguages = ["en", "fi", "sv"] as const;
export type ReaderLanguage = (typeof readerLanguages)[number];

export const readerTranslations = {
  en: {
    allIssues: "← All issues",
    allIssuesLabel: "All issues",
    articles: "Articles",
    article: "Article",
    backToContents: "Back to contents",
    backToHome: "← Back to the archive",
    backToIssue: "Back to issue",
    close: "Close",
    contents: "Contents",
    cover: "Cover",
    credits: "Credits",
    footnoteBack: "Back to reference",
    footnotes: "Footnotes",
    issues: "issues",
    language: "Language",
    navigation: "Page navigation",
    next: "Next",
    nextArticle: "Next article",
    nextPage: "Next page",
    notFound: "Page not found",
    page: "Page",
    pages: "Pages",
    previous: "Previous",
    previousArticle: "Previous article",
    previousPage: "Previous page",
    readingProgress: "Reading progress",
    settings: "Settings",
    skipToContent: "Skip to content",
    sources: "Sources",
    view: "View",
    viewMode: "Reading view",
  },
  fi: {
    allIssues: "← Kaikki numerot",
    allIssuesLabel: "Kaikki numerot",
    articles: "Artikkelit",
    article: "Artikkeli",
    backToContents: "Takaisin sisällysluetteloon",
    backToHome: "← Takaisin etusivulle",
    backToIssue: "Takaisin numeroon",
    close: "Sulje",
    contents: "Sisällys",
    cover: "Kansi",
    credits: "Tekijät",
    footnoteBack: "Takaisin viitteeseen",
    footnotes: "Alaviitteet",
    issues: "numerot",
    language: "Kieli",
    navigation: "Sivunavigaatio",
    next: "Seuraava",
    nextArticle: "Seuraava artikkeli",
    nextPage: "Seuraava sivu",
    notFound: "Sivua ei löytynyt",
    page: "Sivu",
    pages: "Sivut",
    previous: "Edellinen",
    previousArticle: "Edellinen artikkeli",
    previousPage: "Edellinen sivu",
    readingProgress: "Lukemisen edistyminen",
    settings: "Asetukset",
    skipToContent: "Siirry sisältöön",
    sources: "Lähteet",
    view: "Näkymä",
    viewMode: "Lukunäkymä",
  },
  sv: {
    allIssues: "← Alla nummer",
    allIssuesLabel: "Alla nummer",
    articles: "Artiklar",
    article: "Artikel",
    backToContents: "Tillbaka till innehållsförteckningen",
    backToHome: "← Tillbaka till startsidan",
    backToIssue: "Tillbaka till numret",
    close: "Stäng",
    contents: "Innehåll",
    cover: "Omslag",
    credits: "Medverkande",
    footnoteBack: "Tillbaka till referens",
    footnotes: "Fotnoter",
    issues: "nummer",
    language: "Språk",
    navigation: "Sidnavigation",
    next: "Nästa",
    nextArticle: "Nästa artikel",
    nextPage: "Nästa sida",
    notFound: "Sidan hittades inte",
    page: "Sida",
    pages: "Sidor",
    previous: "Föregående",
    previousArticle: "Föregående artikel",
    previousPage: "Föregående sida",
    readingProgress: "Läsförlopp",
    settings: "Inställningar",
    skipToContent: "Hoppa till innehållet",
    sources: "Källor",
    view: "Vy",
    viewMode: "Läsvy",
  },
} as const;

export type ReaderTranslationKey = keyof (typeof readerTranslations)["en"];

export const site = {
  name: "Magazine",
  description: "A responsive, typeset web magazine.",
  locale: "en-GB",
  reader: {
    defaultLanguage: "en" as ReaderLanguage,
    languages: readerLanguages,
    storageKey: "magazine-reader",
  },
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

export function defaultText(key: ReaderTranslationKey): string {
  return readerText(site.reader.defaultLanguage, key);
}
