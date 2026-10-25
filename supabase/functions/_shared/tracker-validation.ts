// Strict validation for v2 only; v1 normalization remains unchanged.
export function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

export function text(value: unknown, label: string, max: number, min = 0): string {
  if (typeof value !== 'string' || value.length < min || value.length > max) throw new Error(`${label} must be a string ${min}-${max} chars`);
  return value;
}

export function optionalFields(
  input: Record<string, unknown>, output: Record<string, unknown>,
  fields: Record<string, (value: unknown) => unknown>, nullable = true,
) {
  for (const [key, validate] of Object.entries(fields)) {
    if (input[key] === undefined) continue;
    output[key] = input[key] === null && nullable ? null : validate(input[key]);
  }
}

export function number(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} must be a number`);
  return value;
}

export function isoDate(value: unknown, label: string): string {
  const date = text(value, label, 10, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error(`${label} must be yyyy-mm-dd`);
  return date;
}