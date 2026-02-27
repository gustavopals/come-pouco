export type UserRole = 'ADMIN' | 'USER';

export const USER_ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  USER: 'Usuário padrão'
};
