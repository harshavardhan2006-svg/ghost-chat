const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AuthFormValues = {
  email: string;
  password: string;
};

export type AuthFormErrors = Partial<Record<keyof AuthFormValues, string>>;

export const validateLogin = (values: AuthFormValues): AuthFormErrors => {
  const errors: AuthFormErrors = {};

  if (!emailPattern.test(values.email.trim())) {
    errors.email = 'Enter a valid email';
  }

  if (values.password.length === 0) {
    errors.password = 'Enter your password';
  }

  return errors;
};

export const validateRegister = (values: AuthFormValues): AuthFormErrors => {
  const errors = validateLogin(values);

  if (values.password.length < 8) {
    errors.password = 'Use at least 8 characters';
  } else if (!/[a-z]/.test(values.password) || !/[A-Z]/.test(values.password) || !/[0-9]/.test(values.password)) {
    errors.password = 'Use uppercase, lowercase, and a number';
  }

  return errors;
};
