export interface AuthUser {
  id: number;
  fullName: string;
  email: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}
