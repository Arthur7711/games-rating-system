export type Tier = {
  id: string;
  label: string;
  color: string;
};

/** Whole board layout. `items` maps a container id (tier id or POOL_ID) to ordered image ids. */
export type BoardState = {
  tiers: Tier[];
  items: Record<string, string[]>;
};

export const POOL_ID = "pool";
export const TRASH_ID = "trash";

export const COLORS = [
  "#ff7f7f", "#ffbf7f", "#ffdf7f", "#ffff7f", "#bfff7f",
  "#7fff7f", "#7fffff", "#7fbfff", "#7f7fff", "#ff7fff",
  "#bf7fbf", "#3b3b3b", "#858585", "#cfcfcf", "#f7f7f7",
];
