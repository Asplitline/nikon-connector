export interface ChangelogSection {
  body: string;
  items: string[];
  title: string;
}

export function parseChangelog(changelog: string): ChangelogSection[] {
  const sections: ChangelogSection[] = [];
  let current: ChangelogSection | null = null;

  for (const rawLine of changelog.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/^#{1,6}\s+/.test(line)) {
      current = {
        body: "",
        items: [],
        title: line.replace(/^#{1,6}\s+/, ""),
      };
      sections.push(current);
      continue;
    }

    if (!current) {
      current = { body: "", items: [], title: "" };
      sections.push(current);
    }

    const bulletMatch = line.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      current.items.push(bulletMatch[1]);
      continue;
    }

    current.body = current.body ? `${current.body}\n${line}` : line;
  }

  const visibleSections = sections.filter(
    (section) =>
      section.body ||
      section.items.length > 0 ||
      !/^changelog|release notes$/i.test(section.title),
  );

  return visibleSections.length > 0
    ? visibleSections
    : [{ body: changelog, items: [], title: "" }];
}
