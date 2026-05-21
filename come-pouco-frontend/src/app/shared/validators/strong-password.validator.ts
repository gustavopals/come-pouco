import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

const OBVIOUS_PASSWORD_PATTERNS = ['123456', 'abcdef', 'qwerty', 'password', 'senha'];

export const strongPasswordValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const value = (control.value || '').trim();

  if (!value.length) {
    return null;
  }

  if (value.length < 10) {
    return { strongPassword: 'A senha deve ter no minimo 10 caracteres.' };
  }

  if (value.length > 128) {
    return { strongPassword: 'A senha deve ter no maximo 128 caracteres.' };
  }

  if (/\s/.test(value)) {
    return { strongPassword: 'A senha nao pode conter espacos.' };
  }

  if (!/[A-Za-z]/.test(value)) {
    return { strongPassword: 'A senha deve conter ao menos 1 letra.' };
  }

  if (!/\d/.test(value)) {
    return { strongPassword: 'A senha deve conter ao menos 1 numero.' };
  }

  if (/(.)\1{2,}/.test(value)) {
    return { strongPassword: 'A senha nao pode conter repeticoes obvias.' };
  }

  const normalized = value.toLowerCase();
  if (OBVIOUS_PASSWORD_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    return { strongPassword: 'A senha nao pode conter sequencias ou palavras obvias.' };
  }

  return null;
};

export const getStrongPasswordErrorMessage = (
  control: AbstractControl<string | null> | null,
): string => {
  const strongPasswordError = control?.getError('strongPassword');

  if (typeof strongPasswordError === 'string') {
    return strongPasswordError;
  }

  return 'A senha nao atende aos criterios de seguranca.';
};
