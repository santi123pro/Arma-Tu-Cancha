// Con "Confirm email" activo, Supabase no responde "User already registered":
// devuelve un usuario sin identidades y sin sesión, y no envía ningún correo.
export function cuentaYaExiste(data) {
  return data?.user?.identities?.length === 0
}
