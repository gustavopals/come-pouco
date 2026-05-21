import { z } from 'zod';

import { COMPANY_ROLES } from '../types/company-role';
import { USER_ROLES } from '../types/user-role';
import {
  idParamsSchema,
  nullableEmailSchema,
  nullableString,
  nullablePositiveIdSchema,
  optionalStrongPasswordSchema,
  paginationQueryShape,
  positiveIdSchema,
  requiredTrimmedString,
  strongPasswordSchema,
  usernameSchema
} from './common.schema';

const userRoleSchema = z.enum(USER_ROLES);
const companyRoleSchema = z.enum(COMPANY_ROLES);

const createUserBodySchema = z
  .object({
    fullName: requiredTrimmedString('Nome', 120),
    username: usernameSchema,
    email: nullableEmailSchema,
    password: strongPasswordSchema,
    role: userRoleSchema.default('USER'),
    companyId: positiveIdSchema('companyId').optional(),
    companyRole: companyRoleSchema.default('EMPLOYEE'),
    publicSlug: nullableString('Slug publico', 80)
  })
  .superRefine((value, ctx) => {
    if (value.role === 'USER' && !value.companyId) {
      ctx.addIssue({
        code: 'custom',
        path: ['companyId'],
        message: 'companyId e obrigatorio para usuarios do tipo USER.'
      });
    }
  });

const createEmployeeBodySchema = z.object({
  fullName: requiredTrimmedString('Nome', 120),
  username: usernameSchema,
  email: nullableEmailSchema,
  password: strongPasswordSchema,
  publicSlug: nullableString('Slug publico', 80)
});

const updateUserBodySchema = z.object({
  fullName: requiredTrimmedString('Nome', 120).optional(),
  username: usernameSchema.optional(),
  email: nullableEmailSchema,
  password: optionalStrongPasswordSchema,
  role: userRoleSchema.optional(),
  companyId: nullablePositiveIdSchema('companyId'),
  companyRole: companyRoleSchema.nullable().optional(),
  publicSlug: nullableString('Slug publico', 80)
});

const userParamsSchema = idParamsSchema;
const userQuerySchema = z.object({
  ...paginationQueryShape
});

type CreateUserBody = z.infer<typeof createUserBodySchema>;
type CreateEmployeeBody = z.infer<typeof createEmployeeBodySchema>;
type UpdateUserBody = z.infer<typeof updateUserBodySchema>;
type UserParams = z.infer<typeof userParamsSchema>;
type UserQuery = z.infer<typeof userQuerySchema>;

export {
  createEmployeeBodySchema,
  createUserBodySchema,
  updateUserBodySchema,
  userParamsSchema,
  userQuerySchema
};
export type { CreateEmployeeBody, CreateUserBody, UpdateUserBody, UserParams, UserQuery };
