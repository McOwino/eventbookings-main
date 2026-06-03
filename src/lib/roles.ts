export const ALL_ROLES = [
  "super_admin",
  "general_executive",
  "clearance_executive",
  "school_trips_executive",
  "birthday_executive",
  "league_executive",
  "marketing_executive",
  "logistics_executive",
  "hangout_executive",
  "sales_executive",
] as const;

export type AppRole = (typeof ALL_ROLES)[number];

// Roles that can edit/delete promotions
export const PROMO_EDIT_ROLES: AppRole[] = ["super_admin", "marketing_executive"];

// Roles that can record deposits
export const DEPOSIT_ROLES: AppRole[] = [...ALL_ROLES];

// Roles that can access clearance
export const CLEARANCE_ROLES: AppRole[] = ["super_admin", "clearance_executive"];
