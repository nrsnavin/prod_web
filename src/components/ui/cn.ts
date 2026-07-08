// Tiny class-combiner — keeps UI components dependency-light.
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
