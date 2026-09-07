import { expect, test } from "@playwright/test";

test("reader switches views and navigates", async ({ page }) => {
  await page.goto("/first-issue");
  await expect(page.locator(".reader-track .reader-article").first()).toBeVisible();
  const coverGeometry = () =>
    page.locator(".reader-track .reader-cover-page").first().evaluate((cover) => {
      const { height, width } = cover.getBoundingClientRect();
      const image = cover.querySelector<HTMLImageElement>(".reader-cover-image");
      const viewport = document.querySelector(".reader-viewport")?.getBoundingClientRect();
      return {
        height,
        width,
        imageRatio: image ? image.naturalWidth / image.naturalHeight : 0,
        viewportHeight: viewport?.height ?? 0,
      };
    });
  const articleCover = await coverGeometry();
  expect(Math.abs(articleCover.height - articleCover.viewportHeight)).toBeLessThanOrEqual(1);
  expect(Math.abs(articleCover.width / articleCover.height - articleCover.imageRatio)).toBeLessThan(0.001);

  await page.getByRole("button", { name: "Pages" }).click();
  await expect(page.locator(".reader")).not.toHaveClass(/is-article-view/);
  const pagedCover = await coverGeometry();
  expect(Math.abs(pagedCover.height - pagedCover.viewportHeight)).toBeLessThanOrEqual(1);
  expect(Math.abs(pagedCover.width / pagedCover.height - pagedCover.imageRatio)).toBeLessThan(0.001);

  const folioEdges = await page.locator(".reader-track .reader-folio").evaluateAll((folios) =>
    folios.map((folio) => {
      const number = folio.querySelector<HTMLElement>(".folio-num");
      const folioRect = folio.getBoundingClientRect();
      const numberRect = number?.getBoundingClientRect();
      return {
        side: [...folio.classList].find((className) => className.startsWith("reader-folio-")),
        leftOffset: numberRect ? numberRect.left - folioRect.left : 0,
        rightOffset: numberRect ? folioRect.right - numberRect.right : 0,
      };
    }),
  );
  for (const folio of folioEdges) {
    if (folio.side === "reader-folio-left") expect(folio.leftOffset).toBeLessThanOrEqual(1);
    if (folio.side === "reader-folio-right") expect(folio.rightOffset).toBeLessThanOrEqual(1);
  }

  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".reader-counter")).not.toBeEmpty();
  await page.getByRole("button", { name: "Articles" }).click();
  await expect(page.locator(".reader")).toHaveClass(/is-article-view/);

  const figureSides = await page
    .locator(".reader-track figure.typeset-figure")
    .evaluateAll((figures) => figures.map((figure) => figure.getAttribute("data-side")));
  expect(figureSides).toContain("left");
  expect(figureSides).toContain("right");

  await page.getByRole("button", { name: "FI", exact: true }).click();
  await expect(page.locator(".toc-main-title").first()).toHaveText("Sisällys");
});
