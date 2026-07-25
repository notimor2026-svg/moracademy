import { createHmac } from "node:crypto";

/**
 * Contraseña interna de la cuenta. Se deriva de un secreto que solo existe en
 * el servidor, por lo que no puede reproducirse a partir del DUI.
 */
export function accountPassword(dui: string): string {
  const secret = process.env.AUTH_DERIVATION_SECRET;
  if (!secret) throw new Error("AUTH_DERIVATION_SECRET no configurado");
  return createHmac("sha256", secret).update(`account:${dui}`).digest("hex");
}
