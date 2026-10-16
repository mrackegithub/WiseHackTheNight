/** Client-side checks mirroring RegisterRequest / LoginRequest in the contract. */
export interface RegisterValues {
  displayName: string;
  email: string;
  password: string;
}

const EMAIL = /^\S+@\S+\.\S+$/;

export function validateRegister(v: RegisterValues): Partial<Record<keyof RegisterValues, string>> {
  const errors: Partial<Record<keyof RegisterValues, string>> = {};
  const name = v.displayName.trim();
  if (name.length < 2 || name.length > 50) errors.displayName = 'Name must be 2–50 characters.';
  if (!EMAIL.test(v.email.trim())) errors.email = 'Enter a valid email address.';
  if (v.password.length < 8) errors.password = 'Password must be at least 8 characters.';
  return errors;
}

export function validateLogin(v: { email: string; password: string }) {
  const errors: { email?: string; password?: string } = {};
  if (!EMAIL.test(v.email.trim())) errors.email = 'Enter a valid email address.';
  if (!v.password) errors.password = 'Enter your password.';
  return errors;
}
