import { z } from 'zod';

import {
  currentPasswordSchema,
  emailSchema,
  idParamsSchema,
  requiredTrimmedString,
  sixDigitCodeSchema,
  strongPasswordSchema,
  twoFactorOrBackupCodeSchema,
  usernameSchema
} from './common.schema';

const loginBodySchema = z.object({
  identifier: requiredTrimmedString('Usuario/e-mail', 255),
  password: currentPasswordSchema
});

const loginTwoFactorBodySchema = z
  .object({
    tempToken: requiredTrimmedString('tempToken', 2048).optional(),
    challengeId: requiredTrimmedString('challengeId', 2048).optional(),
    code: twoFactorOrBackupCodeSchema,
    trustDevice: z.boolean().optional()
  })
  .refine((value) => Boolean(value.tempToken || value.challengeId), {
    message: 'tempToken ou challengeId e obrigatorio.',
    path: ['tempToken']
  });

const registerBodySchema = z.object({
  fullName: requiredTrimmedString('Nome', 120),
  username: usernameSchema,
  email: emailSchema,
  password: strongPasswordSchema
});

const forgotPasswordBodySchema = z.object({
  email: requiredTrimmedString('E-mail', 255)
    .email('E-mail invalido.')
    .transform((value) => value.toLowerCase())
});

const resetPasswordBodySchema = z.object({
  token: requiredTrimmedString('Token', 512).min(20, 'Token invalido.'),
  newPassword: strongPasswordSchema
});

const confirmTwoFactorBodySchema = z.object({
  code: sixDigitCodeSchema
});

const disableTwoFactorBodySchema = z.object({
  password: currentPasswordSchema,
  code: twoFactorOrBackupCodeSchema
});

const trustedDeviceParamsSchema = idParamsSchema;
const adminResetTwoFactorParamsSchema = idParamsSchema;

type LoginBody = z.infer<typeof loginBodySchema>;
type LoginTwoFactorBody = z.infer<typeof loginTwoFactorBodySchema>;
type RegisterBody = z.infer<typeof registerBodySchema>;
type ForgotPasswordBody = z.infer<typeof forgotPasswordBodySchema>;
type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;
type ConfirmTwoFactorBody = z.infer<typeof confirmTwoFactorBodySchema>;
type DisableTwoFactorBody = z.infer<typeof disableTwoFactorBodySchema>;
type TrustedDeviceParams = z.infer<typeof trustedDeviceParamsSchema>;
type AdminResetTwoFactorParams = z.infer<typeof adminResetTwoFactorParamsSchema>;

export {
  adminResetTwoFactorParamsSchema,
  confirmTwoFactorBodySchema,
  disableTwoFactorBodySchema,
  forgotPasswordBodySchema,
  loginBodySchema,
  loginTwoFactorBodySchema,
  registerBodySchema,
  resetPasswordBodySchema,
  trustedDeviceParamsSchema
};
export type {
  AdminResetTwoFactorParams,
  ConfirmTwoFactorBody,
  DisableTwoFactorBody,
  ForgotPasswordBody,
  LoginBody,
  LoginTwoFactorBody,
  RegisterBody,
  ResetPasswordBody,
  TrustedDeviceParams
};
