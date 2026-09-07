/**
 * Page Frame & Spread DOM Renderer.
 *
 * Renders the calculated PageMap into a row of `.reader-spread` containers
 * inside `.reader-track`. Supports both single-page and dual-page spread modes.
 */

import { readerText, resolveReaderLanguage } from "../site";
import type { PageFrameData, PageMap } from "./box";
import { buildPageFootnoteSection } from "./footnotes";

export function buildPageFrame(
  page: PageFrameData,
  pageHeight: number,
  pageSide: "left" | "right" | "single" = "single",
  pageNumber = 1,
): HTMLElement {
  const reader = document.querySelector<HTMLElement>(".reader");
  const publication = reader?.dataset.publication || "Magazine";
  const issueTitle = reader?.dataset.issue || "";
  const publicationIssue = issueTitle ? `${publication} · ${issueTitle}` : publication;
  const frame = document.createElement("div");
  frame.className = "reader-page-frame";

  // 1. Cover Page Frame
  if (page.cover) {
    frame.className = "reader-page-frame reader-cover-frame";
    frame.appendChild(page.cover.cloneNode(true));
    return frame;
  }

  // 2. Table of Contents Frame
  if (page.tocHeader || page.tocItems) {
    const section = document.createElement("section");
    section.className = "reader-page reader-toc-page";
    if (page.tocHeader) {
      section.appendChild(page.tocHeader.cloneNode(true));
    } else if (page.tocItems) {
      const contHeader = document.createElement("header");
      contHeader.className = "reader-toc-header reader-toc-header-cont";
      const contents = readerText(resolveReaderLanguage(document.documentElement.lang), "contents");
      contHeader.innerHTML = `
        <div class="toc-top-row">
          <span class="toc-back-link" style="opacity: 0.75;">${contents}</span>
        </div>
      `;
      section.appendChild(contHeader);
    }

    if (page.tocItems) {
      const ol = document.createElement("ol");
      ol.className = "toc";
      for (const li of page.tocItems) {
        ol.appendChild(li.cloneNode(true));
      }
      section.appendChild(ol);
    }
    frame.appendChild(section);
    return frame;
  }

  // 3. Article Content Page Frame
  const section = document.createElement("section");
  section.className = "reader-page reader-article";
  if (page.isCredits) {
    section.classList.add("reader-credits-page");
  }
  if (page.articleId) section.id = page.articleId;

  // Running Page Folio (Classical Print Magazine Header)
  const folio = document.createElement("div");
  folio.className = `reader-folio reader-folio-${pageSide}`;
  const isArticleOpening = Boolean(page.header);
  if (pageSide === "left") {
    folio.innerHTML = isArticleOpening
      ? `<span class="folio-num">${pageNumber}</span>`
      : `<span class="folio-num">${pageNumber}</span><span class="folio-meta">${publicationIssue}</span>`;
  } else if (pageSide === "right") {
    folio.innerHTML = isArticleOpening
      ? `<span class="folio-num">${pageNumber}</span>`
      : `<span class="folio-meta">${page.articleTitle || publication}</span><span class="folio-num">${pageNumber}</span>`;
  } else {
    folio.innerHTML = isArticleOpening
      ? `<span class="folio-num">${pageNumber}</span>`
      : `<span class="folio-meta">${page.articleTitle || publicationIssue}</span><span class="folio-num">${pageNumber}</span>`;
  }
  section.appendChild(folio);

  if (page.header) {
    section.appendChild(page.header.cloneNode(true));
  }

  const prose = document.createElement("div");
  prose.className = "prose";
  if (!page.header || page.isCredits) {
    prose.dataset.continuation = "true";
  }

  // Elastic glue justification: subtle micro-spacing (<= 4px) across intermediate paragraphs
  const splittableParagraphs = page.units.filter((u) => u.boxType === "paragraph");
  const canJustify =
    page.verticalSlack > 0 && page.verticalSlack <= 32 && splittableParagraphs.length >= 2;
  const addedMarginPerP = canJustify
    ? Math.min(4, Math.floor(page.verticalSlack / (splittableParagraphs.length - 1)))
    : 0;

  let openList: { tag: "UL" | "OL"; el: HTMLElement } | null = null;

  for (let unitIdx = 0; unitIdx < page.units.length; unitIdx++) {
    const unit = page.units[unitIdx];
    const isLastUnit = unitIdx === page.units.length - 1;
    const clone = unit.el.cloneNode(true) as HTMLElement;

    if (addedMarginPerP > 0 && unit.boxType === "paragraph" && !isLastUnit) {
      const currentMb = parseFloat(getComputedStyle(unit.el).marginBottom) || 16;
      clone.style.marginBottom = `${currentMb + addedMarginPerP}px`;
    }

    // Outer-margin dynamic float placement: Left page -> float left, Right page -> float right
    if (
      clone.dataset.weight !== "full" &&
      !clone.dataset.side &&
      (clone.tagName === "FIGURE" ||
        clone.classList.contains("typeset-figure") ||
        clone.classList.contains("typeset-pullquote"))
    ) {
      clone.dataset.side = pageSide === "left" ? "left" : "right";
    }

    if (unit.el.getBoundingClientRect().height > pageHeight) {
      const originalImg = unit.el.matches("img") ? unit.el : unit.el.querySelector("img");
      const cloneImg = clone.matches("img") ? clone : clone.querySelector("img");
      if (cloneImg instanceof HTMLElement && originalImg) {
        const overhead =
          unit.el.getBoundingClientRect().height - originalImg.getBoundingClientRect().height;
        const maxImgHeight = Math.max(0, pageHeight - overhead);
        cloneImg.style.maxHeight = `${maxImgHeight}px`;
        cloneImg.style.width = "auto";
        cloneImg.style.objectFit = "contain";
      }
    }

    if (unit.listTag) {
      if (!openList || openList.tag !== unit.listTag) {
        openList = { tag: unit.listTag, el: document.createElement(unit.listTag) };
        prose.appendChild(openList.el);
      }
      openList.el.appendChild(clone);
    } else {
      openList = null;
      prose.appendChild(clone);
    }
  }

  if (page.footnotes?.length) {
    prose.appendChild(buildPageFootnoteSection(page.footnotes));
  }

  // Simple subtle horizontal rule at conclusion of article
  if (page.isArticleEnd) {
    const endmark = document.createElement("hr");
    endmark.className = "article-endmark";
    endmark.setAttribute("aria-hidden", "true");
    prose.appendChild(endmark);
  }

  section.appendChild(prose);
  frame.appendChild(section);
  return frame;
}

export function renderPageFrames(
  track: HTMLElement,
  pageMap: PageMap,
  pageHeight: number,
  isSpread = false,
): void {
  track.replaceChildren();

  if (!isSpread) {
    for (let pIdx = 0; pIdx < pageMap.pages.length; pIdx++) {
      const frame = buildPageFrame(pageMap.pages[pIdx], pageHeight, "single", pIdx + 1);
      const spread = document.createElement("div");
      spread.className = "reader-spread is-single";
      if (pageMap.pages[pIdx].cover) spread.classList.add("reader-cover-spread");
      spread.appendChild(frame);
      track.appendChild(spread);
    }
    return;
  }

  // Two-page spread mode
  let idx = 0;

  // Cover is on spread 0 as a paired spread (blank left page, cover right page).
  // Coverless issues start pairing from their first content page.
  if (pageMap.pages[0]?.cover) {
    const coverSpread = document.createElement("div");
    coverSpread.className = "reader-spread is-pair reader-cover-spread";

    const blankFrame = document.createElement("div");
    blankFrame.className = "reader-page-frame reader-left-page reader-blank-page";
    blankFrame.setAttribute("aria-hidden", "true");

    const coverFrame = buildPageFrame(pageMap.pages[0], pageHeight, "right", 1);
    coverFrame.classList.add("reader-right-page");

    coverSpread.append(blankFrame, coverFrame);
    track.appendChild(coverSpread);
    idx = 1;
  }

  // Inside pages paired: [1, 2], [3, 4], etc.
  while (idx < pageMap.pages.length) {
    const pairSpread = document.createElement("div");
    pairSpread.className = "reader-spread is-pair";

    const leftFrame = buildPageFrame(pageMap.pages[idx], pageHeight, "left", idx + 1);
    leftFrame.classList.add("reader-left-page");
    pairSpread.appendChild(leftFrame);

    if (idx + 1 < pageMap.pages.length) {
      const rightFrame = buildPageFrame(pageMap.pages[idx + 1], pageHeight, "right", idx + 2);
      rightFrame.classList.add("reader-right-page");
      pairSpread.appendChild(rightFrame);
    } else {
      const blankFrame = document.createElement("div");
      blankFrame.className = "reader-page-frame reader-right-page reader-blank-page";
      blankFrame.setAttribute("aria-hidden", "true");
      pairSpread.appendChild(blankFrame);
    }

    track.appendChild(pairSpread);
    idx += 2;
  }
}
