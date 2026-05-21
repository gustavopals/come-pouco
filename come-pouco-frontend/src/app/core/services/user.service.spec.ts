import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { User } from '../models/user.model';
import { UserService } from './user.service';

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 1,
  fullName: 'Ana Silva',
  username: 'ana',
  email: 'ana@example.com',
  role: 'USER',
  companyId: 10,
  companyRole: 'OWNER',
  publicSlug: 'ana-ofertas',
  twoFactorEnabled: false,
  createdAt: '2026-05-01T10:00:00.000Z',
  ...overrides,
});

describe('UserService', () => {
  let service: UserService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(UserService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('lista usuarios com paginacao', () => {
    service.listUsers({ page: 3, limit: 20 }).subscribe();

    const req = http.expectOne((request) => request.url === `${environment.apiUrl}/users`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('3');
    expect(req.request.params.get('limit')).toBe('20');

    req.flush({
      users: [makeUser()],
      items: [makeUser()],
      meta: { page: 3, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it('coleta todas as paginas de usuarios', () => {
    let received: User[] = [];

    service.listAllUsers().subscribe((users) => {
      received = users;
    });

    let req = http.expectOne(
      (request) =>
        request.url === `${environment.apiUrl}/users` && request.params.get('page') === '1',
    );
    expect(req.request.params.get('limit')).toBe('100');
    req.flush({
      users: [makeUser({ id: 1 })],
      items: [],
      meta: { page: 1, limit: 100, total: 2, totalPages: 2 },
    });

    req = http.expectOne(
      (request) =>
        request.url === `${environment.apiUrl}/users` && request.params.get('page') === '2',
    );
    req.flush({
      users: [makeUser({ id: 2, username: 'bia' })],
      items: [],
      meta: { page: 2, limit: 100, total: 2, totalPages: 2 },
    });

    expect(received.map((user) => user.id)).toEqual([1, 2]);
  });

  it('cria, atualiza, remove e reseta 2FA de usuarios', () => {
    service
      .createUser({
        fullName: 'Bia Souza',
        username: 'bia',
        email: 'bia@example.com',
        password: 'StrongPass123!',
        role: 'USER',
        companyId: 10,
        companyRole: 'EMPLOYEE',
      })
      .subscribe();
    let req = http.expectOne(`${environment.apiUrl}/users`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.username).toBe('bia');
    req.flush({ user: makeUser({ id: 2, username: 'bia' }) });

    service
      .createEmployee({ fullName: 'Caio Lima', username: 'caio', password: 'StrongPass123!' })
      .subscribe();
    req = http.expectOne(`${environment.apiUrl}/users/employees`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      fullName: 'Caio Lima',
      username: 'caio',
      password: 'StrongPass123!',
    });
    req.flush({ user: makeUser({ id: 3, username: 'caio' }) });

    service.updateUser(2, { fullName: 'Bia Atualizada' }).subscribe();
    req = http.expectOne(`${environment.apiUrl}/users/2`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ fullName: 'Bia Atualizada' });
    req.flush({ user: makeUser({ id: 2, fullName: 'Bia Atualizada' }) });

    service.deleteUser(2).subscribe();
    req = http.expectOne(`${environment.apiUrl}/users/2`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    service.resetTwoFactor(2).subscribe();
    req = http.expectOne(`${environment.apiUrl}/admin/users/2/reset-2fa`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(null);
  });
});
