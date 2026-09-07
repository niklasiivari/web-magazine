import { createPageTurn } from "../lib/pageTurn";
import {
  preferredReaderLanguage,
  type ReaderLanguage,
  type ReaderTranslationKey,
  readerLanguages,
  readerText,
  resolveReaderLanguage,
  site,
} from "../lib/site";
import { typesetAndMount } from "../lib/typesetter";

export default function initReader(): void {
  const viewport = document.querySelector<HTMLElement>(".reader-viewport");
  const master = document.querySelector<HTMLElement>(".reader-master");
  const track = document.querySelector<HTMLElement>(".reader-track");
  const counter = document.querySelector<HTMLElement>(".reader-counter");
  const prevBtn = document.querySelector<HTMLButtonElement>(".reader-nav-prev");
  const nextBtn = document.querySelector<HTMLButtonElement>(".reader-nav-next");
  const tocBtn = document.querySelector<HTMLButtonElement>(".reader-toc-button");
  const progressTrack = document.querySelector<HTMLElement>(".reader-progress-track");
  const progressBar = document.querySelector<HTMLElement>(".reader-progress-bar");
  const viewOptions = Array.from(
    document.querySelectorAll<HTMLButtonElement>("[data-reader-view]"),
  );
  const languageOptions = Array.from(
    document.querySelectorAll<HTMLButtonElement>("[data-reader-language]"),
  );
  const settingsToggle = document.querySelector<HTMLButtonElement>(".reader-settings-toggle");
  const settingsDialog = document.querySelector<HTMLElement>(".reader-settings-dialog");
  const settingsClose = document.querySelector<HTMLButtonElement>(".reader-settings-close");
  const settingsBackdrop = document.querySelector<HTMLElement>(".reader-settings-backdrop");
  const reader = viewport?.closest<HTMLElement>(".reader");

  if (!viewport || !master || !track) return;

  type ViewMode = "pages" | "articles";
  const savedLanguage = localStorage.getItem("magazine-reader-language");
  const preferredLanguage = preferredReaderLanguage(navigator.languages);
  let uiLanguage: ReaderLanguage = resolveReaderLanguage(
    savedLanguage || preferredLanguage || site.reader.defaultLanguage,
  );
  const t = (key: ReaderTranslationKey) => readerText(uiLanguage, key);

  const applyReaderLanguage = () => {
    document.documentElement.lang = uiLanguage;
    // The endnote heading is baked into the markdown at build time, so it is
    // the reader — not remark — that has to follow the language toggle.
    for (const heading of document.querySelectorAll<HTMLElement>(".footnotes > h2")) {
      heading.textContent = t("footnotes");
    }
    for (const element of document.querySelectorAll<HTMLElement>("[data-reader-i18n]")) {
      const key = element.dataset.readerI18n as ReaderTranslationKey | undefined;
      if (key) element.textContent = t(key);
    }
    for (const element of document.querySelectorAll<HTMLElement>("[data-reader-i18n-aria-label]")) {
      const key = element.dataset.readerI18nAriaLabel as ReaderTranslationKey | undefined;
      if (key) element.setAttribute("aria-label", t(key));
    }
    for (const element of document.querySelectorAll<HTMLElement>("[data-reader-i18n-title]")) {
      const key = element.dataset.readerI18nTitle as ReaderTranslationKey | undefined;
      if (key) element.title = t(key);
    }
    for (const option of languageOptions) {
      option.setAttribute("aria-pressed", `${option.dataset.readerLanguage === uiLanguage}`);
    }
  };

  let viewMode: ViewMode =
    localStorage.getItem("magazine-reader-view") === "pages" ? "pages" : "articles";

  const spreadPaddingY = () => {
    const vh = window.innerHeight;
    const py = Math.max(24, Math.min(48, vh * 0.04));
    return Math.round(py * 2);
  };

  const viewportWidth = () => viewport.clientWidth;
  const isSpreadMode = () => {
    const width = viewportWidth();
    return viewMode === "pages" && width >= 1100 && width / viewport.clientHeight >= 1.1;
  };
  const sheetWidth = () => {
    const availableWidth = viewportWidth() / 2;
    const portraitWidth = viewport.clientHeight / Math.SQRT2;
    return Math.max(280, Math.floor(Math.min(availableWidth, portraitWidth)));
  };
  const columnWidth = () => {
    const vw = viewportWidth();
    if (isSpreadMode()) {
      return Math.max(280, sheetWidth() - 80);
    }
    const padX = Math.max(24, Math.min(80, vw * 0.06));
    return Math.max(280, Math.min(640, vw - 2 * padX));
  };

  const availablePageHeight = () => {
    const raw = viewport.clientHeight - spreadPaddingY();
    return Math.max(240, Math.floor(raw));
  };

  let articleIndex: Record<string, number> = {};
  let pageCount = 1;
  let navigationWidth = viewport.clientWidth;

  const totalSpreads = () => Math.max(1, track.children.length);

  const hasCoverPage = () => Boolean(master.querySelector(":scope > .reader-cover-page"));

  const currentSpread = () => {
    const width = navigationWidth;
    if (width <= 0) return 0;
    return Math.max(0, Math.min(totalSpreads() - 1, Math.round(viewport.scrollLeft / width)));
  };

  const pageToSpread = (pageIdx: number): number => {
    if (!isSpreadMode()) return pageIdx;
    const coverOffset = hasCoverPage() ? 1 : 0;
    if (coverOffset && pageIdx === 0) return 0;
    return coverOffset + Math.floor((pageIdx - coverOffset) / 2);
  };

  const spreadPageLabel = (spreadIdx: number): string => {
    if (viewMode === "articles") {
      const spread = track.children[spreadIdx] as HTMLElement | undefined;
      return spread?.dataset.readerCounter || `${spreadIdx + 1} / ${totalSpreads()}`;
    }
    if (!isSpreadMode()) {
      return `${spreadIdx + 1} / ${pageCount}`;
    }
    const hasCover = hasCoverPage();
    if (hasCover && spreadIdx === 0) {
      return `1 / ${pageCount}`;
    }
    const leftPage = hasCover ? 2 + (spreadIdx - 1) * 2 : 1 + spreadIdx * 2;
    const rightPage = leftPage + 1;
    if (rightPage > pageCount) {
      return `${leftPage} / ${pageCount}`;
    }
    return `${leftPage}–${rightPage} / ${pageCount}`;
  };

  const buildArticleView = () => {
    track.replaceChildren();
    articleIndex = {};

    const sources = Array.from(master.querySelectorAll<HTMLElement>(":scope > .reader-page"));
    const articles = sources.filter(
      (source) =>
        source.classList.contains("reader-article") &&
        !source.classList.contains("reader-credits-page"),
    );
    let articleNumber = 0;

    for (const source of sources) {
      const spread = document.createElement("div");
      spread.className = "reader-spread is-single reader-article-panel";

      const frame = document.createElement("div");
      frame.className = "reader-page-frame";
      frame.tabIndex = 0;
      const clone = source.cloneNode(true) as HTMLElement;
      if (source.classList.contains("reader-credits-page")) {
        const prose = clone.querySelector<HTMLElement>(".prose");
        if (prose) prose.dataset.continuation = "true";
      }
      clone.querySelectorAll(".data-footnote-backref").forEach((backref) => {
        backref.remove();
      });
      frame.appendChild(clone);
      spread.appendChild(frame);

      if (source.classList.contains("reader-cover-page")) {
        spread.classList.add("reader-cover-spread");
        frame.classList.add("reader-cover-frame");
        spread.dataset.readerCounter = t("cover");
        spread.dataset.readerLabel = t("cover");
      } else if (source.classList.contains("reader-toc-page")) {
        spread.dataset.readerCounter = t("contents");
        spread.dataset.readerLabel = t("contents");
      } else if (source.classList.contains("reader-credits-page")) {
        const title = source.querySelector(".reader-article-header h2")?.textContent?.trim();
        spread.dataset.readerCounter = title || "Tekijät";
        spread.dataset.readerLabel = title || "Tekijät";
        frame.setAttribute("aria-label", spread.dataset.readerLabel);
      } else {
        articleNumber += 1;
        const title = source.querySelector(".reader-article-header h2")?.textContent?.trim();
        spread.dataset.readerCounter = `${articleNumber} / ${articles.length}`;
        spread.dataset.readerLabel = title || `${t("article")} ${articleNumber}`;
        frame.setAttribute("aria-label", spread.dataset.readerLabel);
        if (source.id) articleIndex[source.id] = track.children.length;
      }

      track.appendChild(spread);
    }

    pageCount = track.children.length;
  };

  const mountView = () => {
    const spread = isSpreadMode();
    reader?.classList.toggle("is-spread", spread);
    reader?.classList.toggle("is-article-view", viewMode === "articles");
    master.style.width = `${columnWidth()}px`;
    const width = viewportWidth();
    const pageHeight = availablePageHeight();
    // Set on .reader, not .reader-viewport: the page-turn stage is a sibling
    // of the viewport, so anything scoped to the viewport never reaches the
    // cloned pages inside it.
    const sizeHost = reader ?? viewport;
    sizeHost.style.setProperty("--reader-page-width", `${width}px`);
    sizeHost.style.setProperty("--reader-page-height", `${pageHeight}px`);
    sizeHost.style.setProperty("--reader-sheet-width", `${sheetWidth()}px`);

    if (viewMode === "articles") {
      buildArticleView();
    } else {
      const pageMap = typesetAndMount(master, track, pageHeight, spread);
      articleIndex = Object.fromEntries(
        Object.entries(pageMap.articleIndex).map(([id, page]) => [id, pageToSpread(page)]),
      );
      pageCount = pageMap.pages.length;
    }

    for (const option of viewOptions) {
      option.setAttribute("aria-pressed", `${option.dataset.readerView === viewMode}`);
    }
    prevBtn?.setAttribute(
      "aria-label",
      viewMode === "articles" ? t("previousArticle") : t("previousPage"),
    );
    nextBtn?.setAttribute("aria-label", viewMode === "articles" ? t("nextArticle") : t("nextPage"));

    navigationWidth = viewportWidth();
  };

  const updateControls = () => {
    const spread = currentSpread();
    const count = totalSpreads();

    if (counter) {
      counter.textContent = spreadPageLabel(spread);
    }

    if (progressBar) {
      const progressPercent = count > 1 ? (spread / (count - 1)) * 100 : 100;
      progressBar.style.width = `${progressPercent}%`;
    }

    if (progressTrack) {
      progressTrack.setAttribute("aria-valuenow", `${spread + 1}`);
      progressTrack.setAttribute("aria-valuemax", `${count}`);
      progressTrack.setAttribute("aria-valuetext", spreadPageLabel(spread));
    }

    if (prevBtn) prevBtn.disabled = spread <= 0;
    if (nextBtn) nextBtn.disabled = spread >= count - 1;
  };

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const scrollMode = (): ScrollBehavior => (reducedMotion.matches ? "auto" : "smooth");

  let turning = false;
  let settling = false;
  let queuedDirection: number | null = null;
  let lastTurnTime = 0;
  let rapidStreak = 0;
  let cancelTurn: (() => void) | null = null;
  let cancelSettle: (() => void) | null = null;

  const getTurnDuration = (accelerated = false): number => {
    const now = performance.now();
    const elapsedSinceLast = now - lastTurnTime;
    if (accelerated || elapsedSinceLast < 450) {
      rapidStreak = Math.min(rapidStreak + 1, 5);
    } else {
      rapidStreak = 0;
    }
    lastTurnTime = now;
    if (rapidStreak >= 2) return 180;
    if (rapidStreak === 1) return 260;
    return 420;
  };

  const turnPage = (from: number, to: number, durationMs?: number, onComplete?: () => void) => {
    const fromOffset = from * viewportWidth();
    viewport.scrollLeft = fromOffset;

    const spreads = Array.from(track.querySelectorAll<HTMLElement>(".reader-spread"));
    const fromSpread = spreads[from];
    const toSpread = spreads[to];
    if (!reader || !fromSpread || !toSpread) return false;

    const forward = to > from;
    const fromFrames = Array.from(fromSpread.querySelectorAll<HTMLElement>(".reader-page-frame"));
    const toFrames = Array.from(toSpread.querySelectorAll<HTMLElement>(".reader-page-frame"));
    const paired =
      fromSpread.classList.contains("is-pair") && toSpread.classList.contains("is-pair");

    const frontFrame = paired ? fromFrames[forward ? 1 : 0] : fromFrames[0];
    const backFrame = paired ? toFrames[forward ? 0 : 1] : toFrames[0];
    if (!frontFrame || !backFrame) return false;

    turning = true;
    reader.classList.add("is-preparing-turn");
    updateControls();

    const turnDuration = durationMs ?? getTurnDuration();

    let cancelled = false;
    let completed = false;
    const turn = createPageTurn({
      viewport,
      frontFrame,
      backFrame,
      stationaryFrame: paired ? (fromFrames[forward ? 0 : 1] ?? null) : null,
      paired,
      forward,
      durationMs: turnDuration,
    });

    const cleanup = () => {
      turn.cancel();
      reader.classList.remove("is-turning", "is-preparing-turn");
      turning = false;
      cancelTurn = null;
      updateControls();

      if (queuedDirection !== null) {
        const nextDir = queuedDirection;
        queuedDirection = null;
        goTo(currentSpread() + nextDir, true, true, true);
      }
    };

    cancelTurn = () => {
      cancelled = true;
      queuedDirection = null;
      viewport.scrollTo({ left: from * viewportWidth(), behavior: "auto" });
      cleanup();
    };

    reader.appendChild(turn.stage);

    void turn.ready
      .then(() => {
        if (cancelled) return;
        reader.classList.add("is-turning");
        reader.classList.remove("is-preparing-turn");
        viewport.scrollTo({ left: to * viewportWidth(), behavior: "auto" });
        return turn.play().then(() => {
          completed = true;
        });
      })
      .catch((error) => {
        console.error("Could not run page turn", error);
        viewport.scrollTo({ left: to * viewportWidth(), behavior: "auto" });
      })
      .finally(() => {
        if (!cancelled) {
          cleanup();
          if (completed) onComplete?.();
        }
      });

    return true;
  };

  let settleFrame = 0;

  const moveCover = (docked: boolean): Promise<boolean> => {
    const coverSpread = track.querySelector<HTMLElement>(".reader-cover-spread");
    const cover = coverSpread?.querySelector<HTMLElement>(".reader-cover-frame");
    if (!coverSpread || !cover || !isSpreadMode()) return Promise.resolve(false);

    return new Promise((resolve) => {
      let finished = false;
      const finish = (completed: boolean) => {
        if (finished) return;
        finished = true;
        if (completed) coverSpread.classList.toggle("is-cover-docked", docked);
        for (const runningAnimation of cover.getAnimations()) {
          runningAnimation.cancel();
        }
        reader?.classList.remove("is-settling");
        settling = false;
        cancelSettle = null;
        updateControls();
        resolve(completed);
      };

      if (reducedMotion.matches) {
        finish(true);
        return;
      }

      settling = true;
      reader?.classList.add("is-settling");
      const animation = cover.animate(
        docked
          ? [{ transform: "translateX(-50%)" }, { transform: "translateX(0)" }]
          : [{ transform: "translateX(0)" }, { transform: "translateX(-50%)" }],
        {
          duration: 320,
          easing: "cubic-bezier(0.4, 0, 0.2, 1)",
          fill: "forwards",
        },
      );

      cancelSettle = () => finish(false);
      void animation.finished.then(
        () => finish(true),
        () => finish(false),
      );
    });
  };

  const slideTo = (clamped: number, durationMs = 280): Promise<void> => {
    return new Promise((resolve) => {
      cancelAnimationFrame(settleFrame);
      const startX = viewport.scrollLeft;
      const targetX = clamped * viewportWidth();
      const distance = targetX - startX;

      if (reducedMotion.matches || Math.abs(distance) < 1) {
        viewport.scrollLeft = targetX;
        updateControls();
        resolve();
        return;
      }

      settling = true;
      reader?.classList.add("is-settling");
      const startTime = performance.now();
      const ease = (t: number) => 1 - (1 - t) ** 3;

      const step = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / durationMs);
        viewport.scrollLeft = startX + distance * ease(progress);

        if (progress < 1) {
          settleFrame = requestAnimationFrame(step);
        } else {
          viewport.scrollLeft = targetX;
          reader?.classList.remove("is-settling");
          settling = false;
          cancelSettle = null;
          updateControls();
          resolve();
        }
      };

      cancelSettle = () => {
        cancelAnimationFrame(settleFrame);
        viewport.scrollLeft = targetX;
        reader?.classList.remove("is-settling");
        settling = false;
        cancelSettle = null;
        queuedDirection = null;
        updateControls();
        resolve();
      };

      settleFrame = requestAnimationFrame(step);
    });
  };

  const goTo = (spreadIndex: number, animate = true, flip = true, accelerated = false) => {
    // The viewport itself only moves horizontally; article panels own their
    // vertical scrolling. Native fragment navigation can nevertheless leave a
    // vertical offset on the viewport (for example by targeting the hidden
    // master copy), which makes every mounted page appear blank.
    if (viewport.scrollTop !== 0) viewport.scrollTop = 0;

    if (turning || settling) {
      const current = currentSpread();
      const count = totalSpreads();
      const clamped = Math.max(0, Math.min(count - 1, spreadIndex));
      if (clamped !== current) {
        queuedDirection = clamped > current ? 1 : -1;
        rapidStreak = Math.max(rapidStreak, 1);
      }
      return;
    }

    const count = totalSpreads();
    const clamped = Math.max(0, Math.min(count - 1, spreadIndex));
    const current = currentSpread();

    if (viewMode === "articles") {
      const targetLeft = clamped * viewportWidth();
      if (Math.abs(viewport.scrollLeft - targetLeft) > 1) {
        const isAdjacent = clamped !== current && Math.abs(clamped - current) === 1;
        if (animate && isAdjacent) {
          void slideTo(clamped, 280);
        } else {
          viewport.scrollTo({ left: targetLeft, behavior: "auto" });
        }
      }
      track.children[clamped]
        ?.querySelector<HTMLElement>(".reader-page-frame")
        ?.focus({ preventScroll: true });
      updateControls();
      return;
    }

    if (clamped === current) {
      updateControls();
      return;
    }

    const duration = getTurnDuration(accelerated);

    if (
      animate &&
      flip &&
      !reducedMotion.matches &&
      isSpreadMode() &&
      hasCoverPage() &&
      current === 0 &&
      clamped === 1
    ) {
      void moveCover(true).then((completed) => {
        if (completed) turnPage(0, 1, duration);
      });
      return;
    }

    if (animate && flip && isSpreadMode() && current === 1 && clamped === 0) {
      const coverSpread = track.querySelector<HTMLElement>(".reader-cover-spread");
      coverSpread?.classList.add("is-cover-docked");
      if (turnPage(1, 0, duration, () => void moveCover(false))) return;
      coverSpread?.classList.remove("is-cover-docked");
    }

    if (
      animate &&
      flip &&
      viewMode === "pages" &&
      !reducedMotion.matches &&
      turnPage(current, clamped, duration)
    ) {
      return;
    }

    if (!animate) {
      if (clamped === 0) {
        track.querySelector(".reader-cover-spread")?.classList.remove("is-cover-docked");
      }
      viewport.scrollLeft = clamped * viewportWidth();
      updateControls();
      return;
    }

    if (clamped === 0) {
      track.querySelector(".reader-cover-spread")?.classList.remove("is-cover-docked");
    }
    void slideTo(clamped, 280).then(() => {
      if (queuedDirection !== null) {
        const nextDir = queuedDirection;
        queuedDirection = null;
        goTo(currentSpread() + nextDir, true, true, true);
      }
    });
  };

  prevBtn?.addEventListener("click", () => goTo(currentSpread() - 1));
  nextBtn?.addEventListener("click", () => goTo(currentSpread() + 1));
  tocBtn?.addEventListener("click", () => {
    const spreads = Array.from(track.children);
    const tocSpread = spreads.findIndex((spread) => spread.querySelector(".reader-toc-page"));
    if (tocSpread >= 0) goTo(tocSpread, true);
  });

  for (const option of viewOptions) {
    option.addEventListener("click", () => {
      const requestedMode = option.dataset.readerView as ViewMode | undefined;
      if (!requestedMode || requestedMode === viewMode) return;

      cancelTurn?.();
      cancelSettle?.();
      const previousSpread = currentSpread();
      const activeArticle =
        track.children[previousSpread]?.querySelector<HTMLElement>(".reader-article[id]")?.id;

      reader?.classList.add("is-switching-view");
      viewMode = requestedMode;
      localStorage.setItem("magazine-reader-view", viewMode);
      mountView();

      const target = activeArticle
        ? articleIndex[activeArticle]
        : Math.min(previousSpread, totalSpreads() - 1);
      goTo(target ?? 0, false);
      requestAnimationFrame(() => reader?.classList.remove("is-switching-view"));
    });
  }

  for (const option of languageOptions) {
    option.addEventListener("click", () => {
      const requestedLanguage = option.dataset.readerLanguage;
      if (
        !requestedLanguage ||
        !readerLanguages.includes(requestedLanguage as ReaderLanguage) ||
        requestedLanguage === uiLanguage
      )
        return;

      cancelTurn?.();
      cancelSettle?.();
      const previousSpread = currentSpread();
      const activePanel = track.children[previousSpread];
      const activeArticle = activePanel?.querySelector<HTMLElement>(".reader-article[id]")?.id;
      const previousScroller = activePanel?.querySelector<HTMLElement>(".reader-page-frame");
      const previousScrollableHeight = previousScroller
        ? previousScroller.scrollHeight - previousScroller.clientHeight
        : 0;
      const verticalProgress =
        previousScroller && previousScrollableHeight > 0
          ? previousScroller.scrollTop / previousScrollableHeight
          : 0;

      reader?.classList.add("is-switching-view");
      uiLanguage = requestedLanguage as ReaderLanguage;
      localStorage.setItem("magazine-reader-language", uiLanguage);
      applyReaderLanguage();
      mountView();

      const target = activeArticle
        ? articleIndex[activeArticle]
        : Math.min(previousSpread, totalSpreads() - 1);
      goTo(target ?? 0, false);
      if (viewMode === "articles") {
        const nextScroller =
          track.children[target ?? 0]?.querySelector<HTMLElement>(".reader-page-frame");
        if (nextScroller) {
          nextScroller.scrollTop =
            verticalProgress * (nextScroller.scrollHeight - nextScroller.clientHeight);
        }
      }
      requestAnimationFrame(() => reader?.classList.remove("is-switching-view"));
    });
  }

  const openSettings = () => {
    if (!settingsDialog || !settingsToggle) return;
    settingsDialog.hidden = false;
    settingsToggle.setAttribute("aria-expanded", "true");
  };

  const closeSettings = () => {
    if (!settingsDialog || !settingsToggle) return;
    settingsDialog.hidden = true;
    settingsToggle.setAttribute("aria-expanded", "false");
  };

  const toggleSettings = () => {
    if (!settingsDialog) return;
    if (settingsDialog.hidden) {
      openSettings();
    } else {
      closeSettings();
    }
  };

  settingsToggle?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleSettings();
  });

  settingsClose?.addEventListener("click", (e) => {
    e.stopPropagation();
    closeSettings();
  });

  settingsBackdrop?.addEventListener("click", () => {
    closeSettings();
  });

  document.addEventListener("click", (e) => {
    if (settingsDialog && !settingsDialog.hidden) {
      const target = e.target as Node | null;
      const panel = settingsDialog.querySelector(".reader-settings-panel");
      if (panel && !panel.contains(target) && !settingsToggle?.contains(target)) {
        closeSettings();
      }
    }
  });

  window.addEventListener("keydown", (e) => {
    if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) {
      return;
    }

    if (e.key === "Escape" && settingsDialog && !settingsDialog.hidden) {
      e.preventDefault();
      closeSettings();
      settingsToggle?.focus();
      return;
    }

    if (viewMode === "articles") {
      const scroller =
        track.children[currentSpread()]?.querySelector<HTMLElement>(".reader-page-frame");
      if (scroller) {
        let top: number | undefined;
        if (e.key === "ArrowDown") top = scroller.scrollTop + 48;
        if (e.key === "ArrowUp") top = scroller.scrollTop - 48;
        if (e.key === "PageDown" || (e.key === " " && !e.shiftKey)) {
          top = scroller.scrollTop + scroller.clientHeight * 0.85;
        }
        if (e.key === "PageUp" || (e.key === " " && e.shiftKey)) {
          top = scroller.scrollTop - scroller.clientHeight * 0.85;
        }
        if (e.key === "Home") top = 0;
        if (e.key === "End") top = scroller.scrollHeight;
        if (top !== undefined) {
          e.preventDefault();
          scroller.scrollTo({ top, behavior: scrollMode() });
          return;
        }
      }
    }

    const nextPageKey =
      viewMode === "pages" && (e.key === "PageDown" || (e.key === " " && !e.shiftKey));
    const previousPageKey =
      viewMode === "pages" && (e.key === "PageUp" || (e.key === " " && e.shiftKey));

    if (e.key === "ArrowRight" || nextPageKey) {
      e.preventDefault();
      goTo(currentSpread() + 1, true, true, e.repeat);
    } else if (e.key === "ArrowLeft" || previousPageKey) {
      e.preventDefault();
      goTo(currentSpread() - 1, true, true, e.repeat);
    } else if (viewMode === "pages" && e.key === "Home") {
      e.preventDefault();
      goTo(0, true, false);
    } else if (viewMode === "pages" && e.key === "End") {
      e.preventDefault();
      goTo(totalSpreads() - 1, true, false);
    }
  });

  // Interactive progress bar scrubber
  if (progressTrack) {
    const tooltip = document.createElement("div");
    tooltip.className = "reader-scrubber-tooltip";
    document.body.appendChild(tooltip);

    const scrubTarget = (clientX: number) => {
      const rect = progressTrack.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return Math.round(ratio * (totalSpreads() - 1));
    };

    const previewScrub = (clientX: number) => {
      const targetSpread = scrubTarget(clientX);
      if (progressBar) {
        const progressPercent =
          totalSpreads() > 1 ? (targetSpread / (totalSpreads() - 1)) * 100 : 100;
        progressBar.style.width = `${progressPercent}%`;
      }
      return targetSpread;
    };

    const updateTooltip = (clientX: number) => {
      const rect = progressTrack.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const targetSpread = Math.round(ratio * (totalSpreads() - 1));
      const spreads = Array.from(track.querySelectorAll<HTMLElement>(".reader-spread"));
      const spreadEl = spreads[targetSpread];
      if (!spreadEl) return;

      const pageNumText = spreadPageLabel(targetSpread);
      const articlePage = spreadEl.querySelector<HTMLElement>(".reader-article[id]");
      const sourceArticle = articlePage?.id
        ? master.querySelector<HTMLElement>(
            `#${CSS.escape(articlePage.id)} .reader-article-header h2`,
          )
        : null;
      const articleEl =
        spreadEl.querySelector<HTMLElement>(".reader-article-header h2") || sourceArticle;
      const isToc = Boolean(spreadEl.querySelector(".reader-toc-page"));
      const title =
        spreadEl.dataset.readerLabel ||
        articleEl?.textContent?.trim() ||
        (targetSpread === 0 ? t("cover") : isToc ? t("contents") : t("page"));

      tooltip.textContent = `${title} · ${pageNumText}`;
      tooltip.style.left = `${clientX}px`;
      tooltip.style.top = `${rect.top - 32}px`;
      tooltip.style.opacity = "1";
    };

    let scrubPointer: number | null = null;
    let pendingScrubTarget: number | null = null;

    progressTrack.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      cancelTurn?.();
      cancelSettle?.();
      queuedDirection = null;
      scrubPointer = e.pointerId;
      progressTrack.setPointerCapture(e.pointerId);
      pendingScrubTarget = previewScrub(e.clientX);
      updateTooltip(e.clientX);
    });
    progressTrack.addEventListener("pointermove", (e) => {
      updateTooltip(e.clientX);
      if (scrubPointer === e.pointerId) pendingScrubTarget = previewScrub(e.clientX);
    });
    progressTrack.addEventListener("pointerup", (e) => {
      if (scrubPointer !== e.pointerId) return;
      pendingScrubTarget = previewScrub(e.clientX);
      scrubPointer = null;
      progressTrack.releasePointerCapture(e.pointerId);
      if (pendingScrubTarget !== null) goTo(pendingScrubTarget, true);
      pendingScrubTarget = null;
    });
    progressTrack.addEventListener("pointercancel", () => {
      scrubPointer = null;
      pendingScrubTarget = null;
      updateControls();
    });
    progressTrack.addEventListener("mouseleave", () => {
      if (scrubPointer === null) tooltip.style.opacity = "0";
    });
    progressTrack.addEventListener("keydown", (e) => {
      let target: number | null = null;
      if (e.key === "ArrowLeft" || e.key === "PageUp") target = currentSpread() - 1;
      if (e.key === "ArrowRight" || e.key === "PageDown") target = currentSpread() + 1;
      if (e.key === "Home") target = 0;
      if (e.key === "End") target = totalSpreads() - 1;
      if (target === null) return;
      e.preventDefault();
      e.stopPropagation();
      goTo(target, true);
    });
  }

  // Touch gesture handler (1:1 clamped carousel drag)
  let dragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartTime = 0;
  let dragStartSpread = 0;
  let dragAxis: "pending" | "horizontal" | "vertical" = "pending";

  viewport.addEventListener(
    "touchstart",
    (e) => {
      if (turning || settling || e.touches.length !== 1) return;
      dragging = true;
      dragStartX = e.touches[0].clientX;
      dragStartY = e.touches[0].clientY;
      dragStartTime = performance.now();
      dragStartSpread = currentSpread();
      dragAxis = viewMode === "articles" ? "pending" : "horizontal";
    },
    { passive: true },
  );

  viewport.addEventListener(
    "touchmove",
    (e) => {
      if (!dragging || e.touches.length !== 1) return;
      const width = viewportWidth();
      const delta = dragStartX - e.touches[0].clientX;
      const deltaY = dragStartY - e.touches[0].clientY;

      if (dragAxis === "pending" && Math.max(Math.abs(delta), Math.abs(deltaY)) >= 8) {
        dragAxis = Math.abs(delta) > Math.abs(deltaY) ? "horizontal" : "vertical";
      }
      // Vertical panning in article view is the browser's: `touch-action: pan-y`
      // on the frame lets it scroll natively, with the fling, rubber-banding and
      // momentum a hand-rolled `scrollTop += delta` can never reproduce.
      if (dragAxis === "vertical" && viewMode === "articles") return;
      if (dragAxis !== "horizontal") return;

      e.preventDefault();
      const clampedDelta = Math.max(-width, Math.min(width, delta));
      viewport.scrollLeft = dragStartSpread * width + clampedDelta;
    },
    { passive: false },
  );

  const endDrag = (e: TouchEvent) => {
    if (!dragging) return;
    dragging = false;
    if (dragAxis !== "horizontal") return;

    const width = viewportWidth();
    const endX = e.changedTouches[0]?.clientX ?? dragStartX;
    const delta = dragStartX - endX;
    const elapsed = Math.max(performance.now() - dragStartTime, 1);
    const velocity = Math.abs(delta) / elapsed;

    const pastDistanceThreshold = Math.abs(delta) > width * 0.2;
    const isQuickFlick = velocity > 0.5;

    const direction = delta > 0 ? 1 : -1;
    const target =
      pastDistanceThreshold || isQuickFlick ? dragStartSpread + direction : dragStartSpread;
    if (viewMode === "articles") {
      void slideTo(Math.max(0, Math.min(totalSpreads() - 1, target)), 280);
      return;
    }
    viewport.scrollLeft = dragStartSpread * width;
    goTo(target, true, target !== dragStartSpread, isQuickFlick);
  };

  viewport.addEventListener("touchend", endDrag);
  viewport.addEventListener("touchcancel", endDrag);

  // Trackpad swipe debounced handler
  let wheelPage: number | null = null;
  let wheelDelta = 0;
  let wheelEnd: ReturnType<typeof setTimeout>;

  viewport.addEventListener(
    "wheel",
    (e) => {
      const isHorizontalArticleGesture =
        viewMode === "articles" &&
        Math.abs(e.deltaX) >= 12 &&
        Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.5;
      // Vertical wheel/trackpad scrolling belongs to the panel itself now that
      // it is a real scroller — intercepting it only cost the browser's own
      // smoothing and inertia.
      if (viewMode === "articles" && !e.shiftKey && !isHorizontalArticleGesture) return;

      const delta = e.shiftKey ? e.deltaY : e.deltaX;
      if (!delta) return;

      e.preventDefault();
      clearTimeout(wheelEnd);
      wheelEnd = setTimeout(() => {
        wheelPage = null;
        wheelDelta = 0;
      }, 120);

      if (wheelPage !== null) return;

      wheelDelta += delta;
      if (Math.abs(wheelDelta) < 12) return;

      wheelPage = currentSpread();
      goTo(wheelPage + (wheelDelta > 0 ? 1 : -1));
    },
    { passive: false },
  );

  const snapToNearest = () => {
    if (dragging || turning || settling) return;
    const target = Math.round(viewport.scrollLeft / viewportWidth()) * viewportWidth();
    if (Math.abs(viewport.scrollLeft - target) > 1) {
      viewport.scrollTo({ left: target, behavior: scrollMode() });
    }
    updateControls();
  };

  viewport.addEventListener("scroll", updateControls);
  if ("onscrollend" in window) {
    viewport.addEventListener("scrollend", snapToNearest);
  } else {
    let debounce: ReturnType<typeof setTimeout>;
    viewport.addEventListener("scroll", () => {
      if (dragging) return;
      clearTimeout(debounce);
      debounce = setTimeout(snapToNearest, 120);
    });
  }

  let resizeFrame = 0;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      cancelTurn?.();
      cancelSettle?.();

      const previousSpread = currentSpread();
      const activePanel = track.children[previousSpread];
      const activeArticle = activePanel?.querySelector<HTMLElement>(".reader-article[id]")?.id;
      const previousScroller = activePanel?.querySelector<HTMLElement>(".reader-page-frame");
      const previousScrollableHeight = previousScroller
        ? previousScroller.scrollHeight - previousScroller.clientHeight
        : 0;
      const verticalProgress =
        previousScroller && previousScrollableHeight > 0
          ? previousScroller.scrollTop / previousScrollableHeight
          : 0;

      reader?.classList.add("is-switching-view");
      mountView();

      const target = activeArticle
        ? articleIndex[activeArticle]
        : Math.min(previousSpread, totalSpreads() - 1);
      goTo(target ?? 0, false);

      if (viewMode === "articles") {
        const nextScroller =
          track.children[target ?? 0]?.querySelector<HTMLElement>(".reader-page-frame");
        if (nextScroller) {
          nextScroller.scrollTop =
            verticalProgress * (nextScroller.scrollHeight - nextScroller.clientHeight);
        }
      }

      requestAnimationFrame(() => reader?.classList.remove("is-switching-view"));
    });
  });

  track.addEventListener("click", (e) => {
    const link = (e.target as HTMLElement).closest<HTMLAnchorElement>("a");
    if (!link) return;

    const href = link.getAttribute("href");
    if (href?.startsWith("#user-content-fn")) {
      e.preventDefault();
      const targetId = href.slice(1);
      const target = Array.from(track.querySelectorAll<HTMLElement>("[id]")).find(
        (element) => element.id === targetId,
      );
      const targetSpreadElement = target?.closest<HTMLElement>(".reader-spread");
      const targetSpread = targetSpreadElement
        ? Array.from(track.children).indexOf(targetSpreadElement)
        : -1;

      if (target && targetSpread >= 0) {
        goTo(targetSpread, true);
        window.setTimeout(
          () => {
            target.classList.add("is-footnote-target");
            if (viewMode === "articles") {
              const frame = target.closest<HTMLElement>(".reader-page-frame");
              if (frame) {
                const targetRect = target.getBoundingClientRect();
                const frameRect = frame.getBoundingClientRect();
                frame.scrollTo({
                  top:
                    frame.scrollTop +
                    targetRect.top -
                    frameRect.top -
                    frame.clientHeight / 2 +
                    targetRect.height / 2,
                  behavior: scrollMode(),
                });
              }
            }
            window.setTimeout(() => target.classList.remove("is-footnote-target"), 1400);
          },
          viewMode === "articles" ? 320 : 480,
        );
      }
      return;
    }

    const readerJump = link.closest<HTMLAnchorElement>("[data-reader-jump]");
    if (!readerJump) return;
    e.preventDefault();
    const id = readerJump.getAttribute("data-reader-jump");
    const targetSpread = id ? articleIndex[id] : undefined;
    if (targetSpread !== undefined) {
      goTo(targetSpread, true);
    }
  });

  applyReaderLanguage();
  mountView();
  goTo(0, false);
}
