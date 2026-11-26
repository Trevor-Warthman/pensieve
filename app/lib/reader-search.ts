import Fuse from "fuse.js";

export interface SearchEntry {
  title: string;
  slug: string;
  content?: string;
  tags: string[];
}

export function searchTerms(query: string): string[] {
  return [...new Set(normalize(query).split(" ").filter(Boolean))];
}

function normalize(value: string): string {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function createReaderSearch<T extends SearchEntry>(entries: T[]) {
  const records = entries.map((entry) => ({
    entry,
    title: normalize(entry.title),
    titleWords: normalize(entry.title).split(" "),
    path: normalize(entry.slug),
    tags: normalize(entry.tags.join(" ")),
    content: normalize(entry.content ?? ""),
  }));
  let fuzzy: Fuse<(typeof records)[number]> | undefined;

  return (query: string, limit: number): T[] => {
    const terms = searchTerms(query);
    if (!terms.length) return [];
    const phrase = terms.join(" ");
    const ranked = records.flatMap((record) => {
      let score = 0;
      for (const term of terms) {
        if (record.titleWords.some((word) => word.startsWith(term))) score += 12;
        else if (record.title.includes(term)) score += 8;
        else if (record.tags.includes(term)) score += 6;
        else if (record.path.includes(term)) score += 4;
        else if (record.content.includes(term)) score += 1;
        else return [];
      }
      if (record.title === phrase) score += 50;
      else if (record.title.startsWith(phrase)) score += 20;
      return [{ entry: record.entry, score }];
    }).sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title) ||
      a.entry.slug.localeCompare(b.entry.slug));

    if (ranked.length) return ranked.slice(0, limit).map(({ entry }) => entry);
    if (phrase.length < 4) return [];
    // Typo fallback only when no result contains every term. Never fuzzy-match body text.
    fuzzy ??= new Fuse(records, {
      keys: [{ name: "title", weight: 3 }, "path", "tags"],
      threshold: 0.4,
      ignoreLocation: true,
    });
    const matches = terms.map((term) => new Map(fuzzy!.search(term).map((result, order) => [result.item, order])));
    return records.flatMap((record) => {
      if (!matches.every((match) => match.has(record))) return [];
      return [{ entry: record.entry, rank: matches.reduce((sum, match) => sum + match.get(record)!, 0) }];
    }).sort((a, b) => a.rank - b.rank).slice(0, limit).map(({ entry }) => entry);
  };
}

export function noteHref(lexicon: string, slug: string): string {
  return `/${encodeURIComponent(lexicon)}/${slug.split("/").map(encodeURIComponent).join("/")}`;
}
