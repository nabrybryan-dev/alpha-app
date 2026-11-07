// La puerta de la cadena de agentes en la APP, para el n8n del ASUS (7-nov-2026).
//
// POR QUÉ EXISTE. Tres flujos leían y escribían la base de la app con
// `supabase db query --linked --project-ref sbzmbiwrnvegrticatza`, y eso se cayó tres veces
// (contraseña rotada, sesión de la CLI vencida, `LegacyDbConfigIpv6Error` al perder el ASUS el
// IPv6). Es el mismo patrón de `cola-agentes` en la landing: HTTPS, una clave en cabecera y una
// lista cerrada de acciones, cada una una RPC de la migración `cadena_agentes_sin_cli.sql`.
//
// POST { accion, ... }   cabecera obligatoria x-alpha-clave = ALPHA_CADENA_SECRET
//   { accion: "salud" }                                     -> rows: [{ok, ahora}]
//   { accion: "altas_pendientes" }                          -> rows: [{usuario_id, creado_en}]
//   { accion: "respuestas_preg" }                           -> rows: [{respuesta_id, cuestionario_id, ...}]
//   { accion: "insertar_cuestionario", id, datos, asignado_a } -> rows: [{id, confirmado_en}]
//   { accion: "canario_restos" }                            -> rows: [{usuario_id, creado_en}]
//   { accion: "canario_estado" | "canario_proponer" | "canario_borrar", usuario_id } -> rows: [{...}]
//   { accion: "latido", origen, detalle? }                  -> rows: [{origen, visto_en}]   (0173)
//   { accion: "vigilar_latidos" }  (lo llama pg_cron)        -> rows: [{origen, cambio, avisado}]
//     Avisa por Telegram (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID, los de `responder-chat`) UNA
//     vez cuando un origen lleva más de 30 min sin latir y otra cuando vuelve.
//
// LO QUE NO DEJA HACER, a propósito:
//   · No hay SQL libre ni nombre de RPC en la petición: la acción se traduce aquí.
//   · `insertar_cuestionario` solo ids `preg-…`, datos objeto (≤ 64 KB), 1-20 uuid asignados, y
//     si el id ya existe no lo pisa (como el INSERT del nodo de antes).
//   · Las acciones `canario_*` solo valen para cuentas canario (nombre `PRUEBA-AGENTES-CANARIO …`
//     y correo `prueba-agentes-canario-…@invalid.test`): con la clave no se toca a nadie real.
//
// Despliegue (lo hace Bryan; ver cinta/sin-cli/ENCENDER.md):
//   supabase functions deploy cadena-agentes --no-verify-jwt --project-ref sbzmbiwrnvegrticatza
// Usa SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (los trae el entorno) y ALPHA_CADENA_SECRET, un
// secreto PROPIO (no el de `alta-cliente`): quien tenga esta clave no crea cuentas.

import { createClient } from "npm:@supabase/supabase-js@2";
import { atender, type Avisar, type Rpc } from "./logica.ts";

const env = (k: string) => Deno.env.get(k) ?? "";

const sb = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const rpc: Rpc = async (nombre, args) => {
  const { data, error } = await sb.rpc(nombre, args ?? {});
  return { data, error: error ? { message: error.message } : null };
};

// Sin secretos de Telegram no sale nada y devuelve false: el aviso queda pendiente, no perdido.
const avisar: Avisar = async (texto) => {
  const token = env("TELEGRAM_BOT_TOKEN");
  const chat = env("TELEGRAM_CHAT_ID");
  if (!token || !chat) return false;
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text: texto }),
    signal: AbortSignal.timeout(4000),
  });
  return r.ok;
};

Deno.serve(async (req) => {
  const r = await atender(
    req.method,
    req.headers.get("x-alpha-clave") ?? "",
    env("ALPHA_CADENA_SECRET"),
    () => req.json(),
    rpc,
    (texto) => console.error("cadena-agentes:", texto),
    avisar,
  );
  return new Response(JSON.stringify(r.cuerpo), {
    status: r.estado,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
});
