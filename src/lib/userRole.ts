export const ADMIN_ROLE = 'admin';

export const isAdminRole = (role?: string | null) =>
  String(role || '').trim().toLowerCase() === ADMIN_ROLE;
