export const normalizeRollTargetToken = (value: string | null | undefined) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "";

  const separatorIndex = normalized.indexOf(":");
  if (separatorIndex <= 0) return normalized;

  return normalized.slice(0, separatorIndex).trim();
};

export type PasswordChangeValidationError =
  | ""
  | "required"
  | "tooShort"
  | "mismatch";

export const getPasswordChangeValidationError = (
  password: string,
  confirmPassword: string,
): PasswordChangeValidationError => {
  if (!password.trim()) return "required";
  if (password.length < 6) return "tooShort";
  if (password !== confirmPassword) return "mismatch";

  return "";
};
