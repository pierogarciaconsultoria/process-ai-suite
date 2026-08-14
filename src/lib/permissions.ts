const SUPER_ADMIN_EMAIL = "contato@pierogarcia.com.br";

export function isSuperAdmin(user: { email?: string | null } | null | undefined): boolean {
  return user?.email?.trim().toLowerCase() === SUPER_ADMIN_EMAIL;
}
