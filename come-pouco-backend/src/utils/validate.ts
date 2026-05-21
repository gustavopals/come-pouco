import { NextFunction, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';

import HttpError from './httpError';

type ValidationTarget = 'body' | 'query' | 'params';

type ValidationSchemas = Partial<Record<ValidationTarget, z.ZodType>>;

interface ValidationIssue {
  path: string;
  message: string;
  code: string;
}

z.setErrorMap((issue) => {
  if (issue.code === 'invalid_type') {
    if (issue.input === undefined) {
      return { message: 'Campo obrigatorio.' };
    }

    return { message: 'Tipo invalido.' };
  }

  if (issue.code === 'too_small') {
    return { message: 'Valor abaixo do minimo permitido.' };
  }

  if (issue.code === 'too_big') {
    return { message: 'Valor acima do maximo permitido.' };
  }

  if (issue.code === 'invalid_format') {
    return { message: 'Formato invalido.' };
  }

  if (issue.code === 'invalid_value') {
    return { message: 'Valor invalido.' };
  }

  if (issue.code === 'unrecognized_keys') {
    return { message: 'Campo nao reconhecido.' };
  }

  return { message: 'Valor invalido.' };
});

const formatIssuePath = (target: ValidationTarget, path: PropertyKey[]): string => {
  if (!path.length) {
    return target;
  }

  return `${target}.${path.map(String).join('.')}`;
};

const toValidationDetails = (target: ValidationTarget, error: z.ZodError): ValidationIssue[] =>
  error.issues.map((issue) => ({
    path: formatIssuePath(target, issue.path),
    message: issue.message,
    code: issue.code
  }));

const setValidatedTarget = (req: Request, target: ValidationTarget, data: unknown): void => {
  Object.defineProperty(req, target, {
    value: data,
    writable: true,
    configurable: true,
    enumerable: true
  });
};

const validate = (schemas: ValidationSchemas): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const allDetails: ValidationIssue[] = [];

    (Object.keys(schemas) as ValidationTarget[]).forEach((target) => {
      const schema = schemas[target];

      if (!schema) {
        return;
      }

      const parsed = schema.safeParse(req[target]);

      if (!parsed.success) {
        allDetails.push(...toValidationDetails(target, parsed.error));
        return;
      }

      setValidatedTarget(req, target, parsed.data);
    });

    if (allDetails.length) {
      return next(new HttpError(400, 'Dados invalidos.', 'VALIDATION_ERROR', allDetails));
    }

    return next();
  };
};

export { validate };
export type { ValidationIssue };
