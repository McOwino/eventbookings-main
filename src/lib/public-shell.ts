import type { CSSProperties } from "react";

/** Matches VillageMarketPage `.shell-max` content column */
export const PUBLIC_SHELL_MAX_WIDTH_PX = 1100;

export const PUBLIC_SHELL_PADDING_X = "clamp(16px, 4vw, 28px)";

export const PUBLIC_HEADER_PADDING = `14px ${PUBLIC_SHELL_PADDING_X}`;

/** Matches `PublicSiteHeader` inner row `minHeight` — keep modals below this strip */
export const PUBLIC_HEADER_MIN_HEIGHT_PX = 64;

export const PUBLIC_MAIN_PADDING = `clamp(40px, 6vw, 64px) ${PUBLIC_SHELL_PADDING_X} clamp(24px, 5vw, 48px)`;

export const publicShellInnerStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
};
