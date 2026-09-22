// INTERLUDE-2: a Profile is a fully independent school dataset (every
// entity + every Schedule Version) — one per school year, or whatever else
// needs a clean break. Not part of the frozen spec; see D-42.

export interface Profile {
  id: string
  name: string
  /** One of PROFILE_COLORS' `id` — a fixed palette, not a free picker (D-42). */
  color: string
  createdAt: string
}

export interface ProfileColor {
  id: string
  /** pt-BR label (FR-1), shown in the color picker. */
  label: string
  hex: string
}

/**
 * Small, fixed, visually-distinct set — picked so the active one reads
 * clearly as a header accent and a sidebar border alike.
 *
 * User-requested adjustment (2026-09-22): the original set had two
 * orange-ish colors (Laranja/Âmbar) and two red-ish ones (Rosa/Vermelho),
 * too close to tell apart at a glance — Rosa replaced with Amarelo, Âmbar
 * replaced with Preto.
 */
export const PROFILE_COLORS: ProfileColor[] = [
  { id: 'azul', label: 'Azul', hex: '#2f6fed' },
  { id: 'verde', label: 'Verde', hex: '#16a34a' },
  { id: 'roxo', label: 'Roxo', hex: '#7c3aed' },
  { id: 'laranja', label: 'Laranja', hex: '#ea580c' },
  { id: 'amarelo', label: 'Amarelo', hex: '#eab308' },
  { id: 'turquesa', label: 'Turquesa', hex: '#0891b2' },
  { id: 'preto', label: 'Preto', hex: '#111827' },
  { id: 'vermelho', label: 'Vermelho', hex: '#dc2626' },
]

export const DEFAULT_PROFILE_COLOR = PROFILE_COLORS[0]!.id

export function profileColorHex(colorId: string): string {
  return PROFILE_COLORS.find((c) => c.id === colorId)?.hex ?? PROFILE_COLORS[0]!.hex
}

/** A soft, low-alpha tint of a Profile's color — used for the header background accent (AppHeader.vue) without relying on CSS `color-mix()`. */
export function profileColorRgba(colorId: string, alpha: number): string {
  const hex = profileColorHex(colorId)
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
