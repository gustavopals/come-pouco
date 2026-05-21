import { describe, expect, it } from 'vitest';

import HttpError from './httpError';

describe('HttpError', () => {
  it('keeps HTTP metadata on the error instance', () => {
    const details = { field: 'email' };
    const error = new HttpError(400, 'Dados invalidos.', 'VALIDATION_ERROR', details);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(HttpError);
    expect(error.message).toBe('Dados invalidos.');
    expect(error.statusCode).toBe(400);
    expect(error.errorCode).toBe('VALIDATION_ERROR');
    expect(error.details).toBe(details);
  });
});
