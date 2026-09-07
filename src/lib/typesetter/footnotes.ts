import { readerText, resolveReaderLanguage } from "../site";

/**
 * Page-footnote presentation shared by the renderer and the page solver.
 *
 * The master flow carries footnotes as an end-of-article endnote list, but a
 * page renders them as a compact block pinned to the foot of the page. The two
 * are styled very differently, so the solver has to reserve space using the
 * *page* presentation — measuring the endnote list over-reserved by roughly
 * half a block, which left mobile pages a third empty.
 */

/** Renders one endnote definition in the per-page footnote presentation. */
export function clonePageFootnote(footnote: HTMLElement): HTMLElement {
  const clone = footnote.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".data-footnote-backref").forEach((backref) => {
    backref.remove();
  });

  const number = footnote.id.match(/fn-(\d+)$/)?.[1];
  const paragraph = clone.querySelector("p");
  if (number && paragraph) {
    const label = document.createElement("span");
    label.className = "footnote-number";
    label.textContent = `${number}. `;
    paragraph.prepend(label);
  }

  return clone;
}

/** Builds the `<section class="footnotes" data-page-footnotes>` wrapper. */
export function buildPageFootnoteSection(footnotes: HTMLElement[]): HTMLElement {
  const section = document.createElement("section");
  section.className = "footnotes";
  section.dataset.pageFootnotes = "";
  section.setAttribute(
    "aria-label",
    readerText(resolveReaderLanguage(document.documentElement.lang), "footnotes"),
  );
  const list = document.createElement("ol");
  for (const footnote of footnotes) {
    list.appendChild(clonePageFootnote(footnote));
  }
  section.appendChild(list);
  return section;
}

export interface FootnoteMeasurements {
  /** Height of one definition as rendered at the foot of a page, incl. its margin. */
  heights: Map<HTMLElement, number>;
  /** Rule, padding and list margins the block adds on top of its definitions. */
  chrome: number;
}

/**
 * Measures the definitions the way a page will actually render them: cloned
 * into a real page-footnote block inside the same prose column, so font size,
 * line height, indent and the inline number label all match the final layout.
 */
export function measurePageFootnotes(
  prose: HTMLElement,
  definitions: HTMLElement[],
  fallbackChrome: number,
): FootnoteMeasurements {
  const heights = new Map<HTMLElement, number>();
  if (definitions.length === 0) return { heights, chrome: fallbackChrome };

  const section = buildPageFootnoteSection(definitions);
  const list = section.querySelector("ol");
  prose.appendChild(section);

  const clones = Array.from(list?.children ?? []) as HTMLElement[];
  definitions.forEach((definition, index) => {
    const clone = clones[index];
    if (!clone) return;
    const style = getComputedStyle(clone);
    heights.set(
      definition,
      clone.getBoundingClientRect().height + (parseFloat(style.marginBottom) || 0),
    );
  });

  const chrome = list
    ? section.getBoundingClientRect().height - list.getBoundingClientRect().height
    : fallbackChrome;

  section.remove();
  return { heights, chrome };
}
