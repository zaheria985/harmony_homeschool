/**
 * Per-child accent colors.
 *
 * Children are assigned a color by their stable position in the sorted student
 * list — no database column, no migration. Callers pass the index they already
 * have from rendering a list; `kidColorFor` wraps the palette so any family
 * size works.
 *
 * Every entry carries a solid (avatars, rings, bars), a tint background and a
 * readable text color for that tint, plus a border. All six pairs clear 4.5:1
 * text-on-tint in light mode; the dark variants are used via the `dark`
 * sub-object so components can switch without hardcoding hex.
 */

export type KidColor = {
  name: string;
  solid: string;
  bg: string;
  text: string;
  border: string;
  dark: {
    solid: string;
    bg: string;
    text: string;
    border: string;
  };
};

export const KID_COLORS: KidColor[] = [
  {
    name: "teal",
    solid: "#0f6e56",
    bg: "#e1f5ee",
    text: "#085041",
    border: "#9fe1cb",
    dark: { solid: "#5dcaa5", bg: "#12302a", text: "#9fe1cb", border: "#0f6e56" },
  },
  {
    name: "plum",
    solid: "#534ab7",
    bg: "#eeedfe",
    text: "#3c3489",
    border: "#cecbf6",
    dark: { solid: "#afa9ec", bg: "#232048", text: "#cecbf6", border: "#534ab7" },
  },
  {
    name: "terracotta",
    solid: "#c05f33",
    bg: "#fbf1ec",
    text: "#8f4423",
    border: "#e0b096",
    dark: { solid: "#d4713f", bg: "#3a251c", text: "#e8b79c", border: "#c05f33" },
  },
  {
    name: "goldenrod",
    solid: "#a87d25",
    bg: "#fdf6eb",
    text: "#7a5a1b",
    border: "#e8d5a5",
    dark: { solid: "#e0b04a", bg: "#3a3020", text: "#e8d5a5", border: "#a87d25" },
  },
  {
    name: "moss",
    solid: "#3d6641",
    bg: "#eef4ef",
    text: "#2d4a30",
    border: "#b5d1b8",
    dark: { solid: "#8fb593", bg: "#2a3328", text: "#b5d1b8", border: "#3d6641" },
  },
  {
    name: "dusty-blue",
    solid: "#3a5a8c",
    bg: "#edf2f7",
    text: "#2b4368",
    border: "#a8c3e0",
    dark: { solid: "#8fb0d8", bg: "#1e2a3a", text: "#a8c3e0", border: "#3a5a8c" },
  },
];

/** The color for the child at `index` in the family's sorted student list. */
export function kidColorFor(index: number): KidColor {
  if (!Number.isFinite(index) || index < 0) return KID_COLORS[0];
  return KID_COLORS[Math.floor(index) % KID_COLORS.length];
}

/**
 * Build an id → color lookup from an ordered list of children, so components
 * deep in a tree can color a row without knowing its position.
 */
export function kidColorMap<T extends { id: string }>(
  children: T[],
): Record<string, KidColor> {
  const map: Record<string, KidColor> = {};
  children.forEach((child, index) => {
    map[child.id] = kidColorFor(index);
  });
  return map;
}

/** First letter of a child's name, for avatar circles. */
export function kidInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}
