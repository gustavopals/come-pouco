import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PaginatedResponse, PaginationParams } from '../models/pagination.model';
import { CreateUserPayload, UpdateUserPayload, User } from '../models/user.model';
import { buildPaginationParams, collectPaginatedItems } from './pagination-params';

export interface UserListParams extends PaginationParams {
  search?: string | null;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  constructor(private readonly http: HttpClient) {}

  listUsers(params?: UserListParams): Observable<{ users: User[] } & PaginatedResponse<User>> {
    let httpParams = buildPaginationParams(params);

    if (params?.search?.trim()) {
      httpParams = httpParams.set('search', params.search.trim());
    }

    return this.http.get<{ users: User[] } & PaginatedResponse<User>>(
      `${environment.apiUrl}/users`,
      {
        params: httpParams,
      },
    );
  }

  listAllUsers(): Observable<User[]> {
    return collectPaginatedItems(
      (page, limit) => this.listUsers({ page, limit }),
      (response) => (Array.isArray(response.users) ? response.users : (response.items ?? [])),
    );
  }

  createUser(payload: CreateUserPayload): Observable<{ user: User }> {
    return this.http.post<{ user: User }>(`${environment.apiUrl}/users`, payload);
  }

  updateUser(userId: number, payload: UpdateUserPayload): Observable<{ user: User }> {
    return this.http.put<{ user: User }>(`${environment.apiUrl}/users/${userId}`, payload);
  }

  deleteUser(userId: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/users/${userId}`);
  }

  resetTwoFactor(userId: number): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/admin/users/${userId}/reset-2fa`, {});
  }
}
