import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CreateUserPayload, UpdateUserPayload, User } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  constructor(private readonly http: HttpClient) {}

  listUsers(): Observable<{ users: User[] }> {
    return this.http.get<{ users: User[] }>(`${environment.apiUrl}/users`);
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
}
