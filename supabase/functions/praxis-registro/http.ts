// Respuesta JSON con las cabeceras de la función (sacado de index.ts para dejarle espacio; sin cambios de comportamiento).
export const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
}

export const json = (cuerpo: unknown, status = 200): Response =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json', ...CORS } })
