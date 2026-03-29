/**
 * Password must be at least 8 characters and contain:
 * - uppercase letter
 * - lowercase letter
 * - digit
 * - special character
 */
export const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/;

export const PASSWORD_RULES =
  "Min 8 characters with uppercase, lowercase, number, and special character.";

export function validatePassword(password: string): string | null {
  if (!PASSWORD_RE.test(password)) {
    return PASSWORD_RULES;
  }
  return null;
}
