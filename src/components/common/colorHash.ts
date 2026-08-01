/**
 * Deterministic string -> hue mapping so the same symbol/name always
 * renders the same fallback badge color across renders/sessions.
 */
export function hashStringToHue(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash)
    hash |= 0
  }
  return Math.abs(hash) % 360
}

export function hashStringToColor(value: string, saturation = 55, lightness = 45): string {
  return `hsl(${hashStringToHue(value)}, ${saturation}%, ${lightness}%)`
}
