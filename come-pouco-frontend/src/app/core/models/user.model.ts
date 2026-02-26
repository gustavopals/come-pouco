export interface User {
  id: number;
  fullName: string;
  email: string;
  createdAt: string;
}

export interface CreateUserPayload {
  fullName: string;
  email: string;
  password: string;
}

export interface UpdateUserPayload {
  fullName?: string;
  email?: string;
  password?: string;
}
