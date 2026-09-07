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

/** A page ending before an H2 is free of underfull badness only once it is this full */
export const MAJOR_HEADING_FREE_BREAK_FILL = 0.85;

/** An H2 needs this share of the page free to start there (\needspace) */
export const MAJOR_HEADING_MIN_ROOM = 0.3;

/** The same, on an article's opening page beneath its title */
export const MAJOR_HEADING_MIN_ROOM_OPENING = 0.25;

/** A break that leaves less than this share of a page as the article's remainder */
export const ORPHAN_TAIL_MIN = 0.12;

/** Discourages such a break (\widowpenalty for the article's last page) */
export const PENALTY_ORPHAN_TAIL = 2500;

/** An H3 moves to the next page when less than this share of the page is left */
export const SUBHEADING_MIN_ROOM = 0.3;

/** Hard page break (\clearpage equivalent) */
export const PENALTY_FORCE_BREAK = -100000;
