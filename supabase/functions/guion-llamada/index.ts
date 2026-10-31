// Recepción del guion de llamada que arma el agente de la landing (proyecto de la APP, tabla
// `guiones_llamada`, migración 0151). Hermana de alta-cliente: misma puerta, mismo secreto.
//
// POST { "usuario_id": uuid, "guion": { "version": int, ... }, "dia_preferido"?: "YYYY-MM-DD",
//        "franja_preferida"?: "manana" | "tarde" | "noche" }
// Cabecera obligatoria: x-alpha-clave = ALPHA_LINKS_SECRET (secreto de ESTE proyecto, el de la app).
//
// Respuestas (siempre JSON, mismo envoltorio):
//   200 { ok: true,  datos: { id, usuario_id, version }, error: null }   guardado (o ya estaba: idempotente)
//   400 { ok: false, datos: null, error: "<código>" }                    el cuerpo no pasa la validación
//   401 { ok: false, datos: null, error: "no autorizado" }               falta o no coincide x-alpha-clave
//   404 { ok: false, datos: null, error: "usuario no existe" }           usuario_id no está en usuarios_app
//   405 { ok: false, datos: null, error: "solo POST" }
//   413 { ok: false, datos: null, error: "cuerpo demasiado grande" }     más de 32 KB
//   500 { ok: false, datos: null, error: "no se pudo guardar" }          fallo de la base (el detalle va al log)
//
// IDEMPOTENTE. Upsert por (usuario_id, version): reenviar la misma versión reescribe esa fila y no
// crea otra. Para cambiar el guion, la landing sube `guion.version`.
//
// Despliegue: `supabase functions deploy guion-llamada --no-verify-jwt` (lo protege x-alpha-clave).

import { createClient } from "npm:@supabase/supabase-js@2";
import { TOPE_BYTES, igualesSeguro, validarCuerpo } from "./validar.ts";

const env = (k: string) => Deno.env.get(k) ?? "";
const CODIGO_FK = "23503";

function responder(estado: number, datos: Record<string, unknown> | null, error: string | null = null) {
  return new Response(JSON.stringify({ ok: error === null, datos, error }), {
    status: estado,
    headers: { "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return responder(405, null, "solo POST");
  if (!igualesSeguro(env("ALPHA_LINKS_SECRET"), req.headers.get("x-alpha-clave") ?? "")) {
    return responder(401, null, "no autorizado");
  }
  // Primer filtro barato: si la cabecera ya dice que es grande, ni se lee el cuerpo.
  const declarado = Number(req.headers.get("content-length") ?? "0");
  if (declarado > TOPE_BYTES) return responder(413, null, "cuerpo demasiado grande");

  const texto = await req.text().catch(() => "");
  const validacion = validarCuerpo(texto);
  if (!validacion.ok) {
    return responder(validacion.error === "cuerpo demasiado grande" ? 413 : 400, null, validacion.error);
  }
  const v = validacion.valor;

  const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin
    .from("guiones_llamada")
    .upsert(
      {
        usuario_id: v.usuarioId,
        origen: "landing",
        guion: v.guion,
        version: v.version,
        dia_preferido: v.diaPreferido,
        franja_preferida: v.franjaPreferida,
      },
      { onConflict: "usuario_id,version" },
    )
    .select("id, usuario_id, version")
    .single();

  if (error) {
    if (error.code === CODIGO_FK) return responder(404, null, "usuario no existe");
    // Solo el código y el mensaje de la base: nunca el guion, que lleva datos de la persona.
    console.error("guion-llamada: no se pudo guardar", error.code, error.message);
    return responder(500, null, "no se pudo guardar");
  }
  return responder(200, data as Record<string, unknown>);
});
