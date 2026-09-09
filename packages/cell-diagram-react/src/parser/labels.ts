/**
 * Removes a trailing `#` or `//` comment from a statement.
 *
 * Scanning stops at the label separator, because everything after `:` is free
 * text: `a -> b : fixes #42` and `a -> b : see https://x` are labels, not
 * comments. Quoted spans are skipped for the same reason (`as "Cell #1"`), and
 * a marker must follow whitespace so it cannot bite into an id.
 *
 * Whole-line comments are handled by the callers before this runs; a statement
 * that begins with a marker is left untouched here.
 */
export function stripTrailingComment(statement: string): string {
  let inQuotes = false;

  for (let index = 0; index < statement.length; index++) {
    const char = statement[index];

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) {
      continue;
    }
    if (char === ":") {
      return statement;
    }

    const isMarker = char === "#" || (char === "/" && statement[index + 1] === "/");
    if (isMarker && index > 0 && /\s/.test(statement[index - 1])) {
      return statement.slice(0, index).trimEnd();
    }
  }

  return statement;
}

export function splitLabel(statement: string): { body: string; label: string | undefined } {
  const index = statement.indexOf(":");
  if (index === -1) {
    return { body: statement.trim(), label: undefined };
  }

  const label = statement.slice(index + 1).trim();
  return {
    body: statement.slice(0, index).trim(),
    label: label.length > 0 ? label : undefined
  };
}
