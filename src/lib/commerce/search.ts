/**
 * PostgREST `or(...)` filters are a comma/parenthesis separated mini-language.
 * Interpolating raw user input allows an attacker to append extra filters
 * (filter injection). Every search term must pass through here first.
 */
export function safeSearchTerm(raw: string | null | undefined, maxLength = 80): string {
  return (raw ?? "")
    .trim()
    .replace(/[,()*%\\"'`:.]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}
