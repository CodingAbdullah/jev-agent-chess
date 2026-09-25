export type BoardTheme = {
  id: string;
  label: string;
  light: string;
  dark: string;
};

export const BOARD_THEMES: readonly BoardTheme[] = [
  { id: "classic", label: "Classic", light: "#F0D9B5", dark: "#B58863" },
  { id: "green", label: "Green", light: "#EEEED2", dark: "#769656" },
  { id: "blue", label: "Blue", light: "#DEE3E6", dark: "#8CA2AD" },
  { id: "slate", label: "Slate", light: "#D9D9D9", dark: "#6F7A86" },
];

export const DEFAULT_BOARD_THEME_ID = "classic";

export function findBoardTheme(id: string): BoardTheme {
  return BOARD_THEMES.find((theme) => theme.id === id) ?? BOARD_THEMES[0]!;
}
