/**
 * Clave VAPID pública del servidor de empuje.
 *
 * Es una clave pública, no es secreta. El par privado vive solo como secreto de
 * Supabase (función `avisos-plan`). Se puede sobrescribir con la variable
 * `VITE_VAPID_PUBLIC_KEY`.
 */
export const VAPID_PUBLICA_POR_DEFECTO =
  'BDRd3348RNkMDn9Fr6zq9rB6a90Lx3LS0q4hIUQEIDaCvVLpNKuy2fYYrMQoWQJvidhCzVvUU0DjOOuMO2OEScQ'

export function claveVapidPublica(env: string | undefined): string {
  return env || VAPID_PUBLICA_POR_DEFECTO
}
