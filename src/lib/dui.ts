/**
 * Valida formato DUI salvadoreño: 8 dígitos + guion + 1 dígito.
 * Ej: 04567890-1
 */
export function isValidDui(value: string): boolean {
  return /^\d{8}-\d$/.test(value.trim());
}

export function normalizeDui(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 9) return `${digits.slice(0, 8)}-${digits.slice(8)}`;
  return value.trim();
}

/** Password derivada determinística para auth interno (oculta al usuario) */
export function duiPassword(dui: string): string {
  return `MOR-ACADEMY::${dui}::v1`;
}

export function duiEmail(dui: string): string {
  return `${dui.replace(/[^0-9]/g, "")}@dui.moracademy.local`;
}
