/**
 * Typesetting Penalties.
 *
 * Modeled after TeX penalty parameters:
 * - High penalty: Strongly avoid breaking here unless unavoidable.
 * - Negative penalty: Strongly encourage or force breaking here.
 */

export const BADNESS_SCALE = 10000;

/** Discourages stranding a heading at the bottom of a page without body prose (\clubpenalty) */
export const PENALTY_AFTER_HEADING = 7500;

/** Discourages leaving an article title / subtitle alone at the bottom of a page */
export const PENALTY_AFTER_ARTICLE_HEADER = 8500;

/** Strongly discourages breaking immediately after a float before wrapping text is placed */
export const PENALTY_AFTER_FLOAT = 8500;

/** Zero penalty for splitting a paragraph with valid orphan/widow bounds */
export const PENALTY_PARAGRAPH_SPLIT = 0;

/** Strongly prevents splitting lines inside an author signature block across pages */
export const PENALTY_INSIDE_SIGNATURE = 10000;

/** Encouraged cut point at section boundaries */
export const PENALTY_SECTION_BREAK = -1000;

/** Penalty scale for height imbalance between facing left & right pages in a spread */
export const PENALTY_SPREAD_IMBALANCE = 3000;

/** Hard page break (\clearpage equivalent) */
export const PENALTY_FORCE_BREAK = -100000;
