export const OWNER_EMAIL = "bertbroadhead@gmail.com";

export function isOwnerEmail(email: unknown): boolean {
  return typeof email === "string" && email.toLowerCase() === OWNER_EMAIL;
}