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
