/**
 * A filesystem-safe fragment for building download filenames from free-text
 * names (Profile, Schedule Version) — strips characters that are invalid on
 * Windows/macOS/Linux and collapses whitespace into single hyphens, so the
 * result is safe to drop into a filename on any OS without surprises.
 */
export function filenameSafe(part: string): string {
  return part
    .trim()
    .replace(/[/\\:*?"<>|]/g, '')
    .replace(/\s+/g, '-')
}
