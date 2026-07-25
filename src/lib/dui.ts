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

/** PIN de acceso: exactamente 6 dígitos */
export function isValidPin(value: string): boolean {
  return /^\d{6}$/.test(value.trim());
}

export function duiEmail(dui: string): string {
  return `${dui.replace(/[^0-9]/g, "")}@dui.moracademy.local`;
}
