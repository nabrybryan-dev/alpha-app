// Recepción del guion de llamada que arma el agente de la landing (proyecto de la APP, tabla
// `guiones_llamada`, migración 0151). Hermana de alta-cliente: misma puerta, mismo secreto.
//
// POST { "person_id": uuid, "usuario_id"?: uuid | null, "guion": <guion-llamada-v1 de la landing> }
// Cabecera obligatoria: x-alpha-clave = ALPHA_LINKS_SECRET (secreto de ESTE proyecto, el de la app).
//
// CUÁNDO LLEGA. La landing lo manda en cuanto la persona reserva la llamada, ANTES de pagar: todavía
// no tiene cuenta en la app, así que el guion se ata a `person_id` (el id de la persona en la
// landing). Cuando `alta-cliente` crea la cuenta, la landing lo reenvía con `usuario_id` y esa
// llamada ENLAZA todas las filas de esa persona (update por person_id): desde ahí el guion sale
// también en la Ficha. Un guion rehecho que llega sin `usuario_id` hereda el enlace que ya hubiera.
//
// El guion es el objeto de `guionParaApp()` (landing: src/lib/praxis/guion-llamada.ts), con
// `version: "guion-llamada-v1"` y `generado_en` ISO. Día y franja se sacan de `guion.reserva`.
//
// Respuestas (siempre JSON, mismo envoltorio):
//   200 { ok: true,  datos: { id, person_id, usuario_id, revision }, error: null }  guardado (idempotente)
//   400 { ok: false, datos: null, error: "<código>" }                    el cuerpo no pasa la validación:
//       json invalido · cuerpo invalido · campo no esperado[: <clave>] · person_id invalido ·
//       usuario_id invalido · guion invalido · version no soportada · generado_en invalido ·
//       campo mal formado: <campo>
//   401 { ok: false, datos: null, error: "no autorizado" }               falta o no coincide x-alpha-clave
//   404 { ok: false, datos: null, error: "usuario no existe" }           vino usuario_id y no está en usuarios_app
//   405 { ok: false, datos: null, error: "solo POST" }
//   413 { ok: false, datos: null, error: "cuerpo demasiado grande" }     más de 32 KB
//   500 { ok: false, datos: null, error: "no se pudo guardar" }          fallo de la base (el detalle va al log)
//
// IDEMPOTENTE. La revisión es `generado_en` en milisegundos (validar.ts): reenviar el MISMO guion
// cae en la misma (person_id, revision) y el upsert reescribe esa fila sin crear otra. Un guion
// rehecho trae un `generado_en` posterior: fila nueva, y la app lee la de revisión más alta.
// Enlazar también lo es: repetir el update por person_id deja lo mismo.
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

  // Solo el código y el mensaje de la base en el log: nunca el guion, que lleva nombre, correo y WhatsApp.
  const fallo = (paso: string, error: { code?: string; message?: string }) => {
    console.error(`guion-llamada: ${paso}`, error.code, error.message);
    return responder(500, null, "no se pudo guardar");
  };

  // 1. Con usuario_id, la cuenta tiene que existir: un 404 claro antes de escribir nada.
  if (v.usuarioId) {
    const { data: cuenta, error } = await admin.from("usuarios_app").select("id").eq("id", v.usuarioId).maybeSingle();
    if (error) return fallo("no se pudo comprobar la cuenta", error);
    if (!cuenta) return responder(404, null, "usuario no existe");
  }

  // 2. Sin usuario_id, un guion rehecho hereda el enlace que la persona ya tuviera (no se des-enlaza).
  let usuarioId = v.usuarioId;
  if (!usuarioId) {
    const { data: previa, error } = await admin
      .from("guiones_llamada")
      .select("usuario_id")
      .eq("person_id", v.personId)
      .not("usuario_id", "is", null)
      .limit(1)
      .maybeSingle();
    if (error) return fallo("no se pudo leer el enlace previo", error);
    usuarioId = (previa?.usuario_id as string | undefined) ?? null;
  }

  const { data, error } = await admin
    .from("guiones_llamada")
    .upsert(
      {
        person_id: v.personId,
        usuario_id: usuarioId,
        origen: "landing",
        guion: v.guion,
        revision: v.revision,
        dia_preferido: v.diaPreferido,
        franja_preferida: v.franjaPreferida,
      },
      { onConflict: "person_id,revision" },
    )
    .select("id, person_id, usuario_id, revision")
    .single();
  if (error) {
    if (error.code === CODIGO_FK) return responder(404, null, "usuario no existe");
    return fallo("no se pudo guardar", error);
  }

  // 3. Llegó la cuenta: se enlazan TODAS las filas de esa persona, también las revisiones viejas.
  if (v.usuarioId) {
    const { error: errorEnlace } = await admin
      .from("guiones_llamada")
      .update({ usuario_id: v.usuarioId })
      .eq("person_id", v.personId);
    if (errorEnlace) return fallo("no se pudo enlazar a la cuenta", errorEnlace);
  }
  return responder(200, data as Record<string, unknown>);
});
