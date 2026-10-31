// Recepción del guion de llamada que arma el agente de la landing (proyecto de la APP, tabla
// `guiones_llamada`, migración 0151). Hermana de alta-cliente: misma puerta, mismo secreto.
//
// POST { "usuario_id": uuid, "guion": <guion-llamada-v1 tal cual lo arma la landing> }
// Cabecera obligatoria: x-alpha-clave = ALPHA_LINKS_SECRET (secreto de ESTE proyecto, el de la app).
//
// El guion es el objeto de `guionParaApp()` (landing: src/lib/praxis/guion-llamada.ts), con
// `version: "guion-llamada-v1"` y `generado_en` ISO. Día y franja se sacan de `guion.reserva`.
//
// Respuestas (siempre JSON, mismo envoltorio):
//   200 { ok: true,  datos: { id, usuario_id, revision }, error: null }  guardado (o ya estaba: idempotente)
//   400 { ok: false, datos: null, error: "<código>" }                    el cuerpo no pasa la validación:
//       json invalido · cuerpo invalido · campo no esperado[: <clave>] · usuario_id invalido ·
//       guion invalido · version no soportada · generado_en invalido · campo mal formado: <campo>
//   401 { ok: false, datos: null, error: "no autorizado" }               falta o no coincide x-alpha-clave
//   404 { ok: false, datos: null, error: "usuario no existe" }           usuario_id no está en usuarios_app
//   405 { ok: false, datos: null, error: "solo POST" }
//   413 { ok: false, datos: null, error: "cuerpo demasiado grande" }     más de 32 KB
//   500 { ok: false, datos: null, error: "no se pudo guardar" }          fallo de la base (el detalle va al log)
//
// IDEMPOTENTE. La revisión es `generado_en` en milisegundos (validar.ts): reenviar el MISMO guion
// cae en la misma (usuario_id, revision) y el upsert reescribe esa fila sin crear otra. Un guion
// rehecho trae un `generado_en` posterior: fila nueva, y la app lee la de revisión más alta.
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
        revision: v.revision,
        dia_preferido: v.diaPreferido,
        franja_preferida: v.franjaPreferida,
      },
      { onConflict: "usuario_id,revision" },
    )
    .select("id, usuario_id, revision")
    .single();

  if (error) {
    if (error.code === CODIGO_FK) return responder(404, null, "usuario no existe");
    // Solo el código y el mensaje de la base: nunca el guion, que lleva nombre, correo y WhatsApp.
    console.error("guion-llamada: no se pudo guardar", error.code, error.message);
    return responder(500, null, "no se pudo guardar");
  }
  return responder(200, data as Record<string, unknown>);
});
