// Alta de un cliente en la APP de Alpha (proyecto sbzmbiwrnvegrticatza).
//
// POST { "email": string, "nombre": string }            → crea (o encuentra) la cuenta
// POST { "accion": "borrar-prueba", "email": string }   → borra una cuenta de prueba (*@invalid.test)
// Cabecera obligatoria: x-alpha-clave = ALPHA_LINKS_SECRET (secreto de ESTE proyecto).
//
// POR QUE ASI Y NO POR SQL. La cuenta no puede crearse con un insert en auth.users: deja
// columnas a NULL y el login no funciona aunque la fila exista (lo documenta
// cerebro-alpha: agentes/salidas/carga-LAURA-PRECIADO-M1.sql). Se crea con la API admin,
// que además dispara `al_crear_usuario` y deja lista la fila de `usuarios_app` con el
// nombre de `user_metadata.nombre`.
//
// POR QUE UN LINK DE RECUPERACION Y NO UNA INVITACION. La app solo reconoce el enlace de
// «olvidé mi contraseña» (evento PASSWORD_RECOVERY → NuevaClavePage). Con uno de
// invitación el cliente entraría sin contraseña y no podría volver. Por eso: cuenta
// confirmada con una clave aleatoria que nadie guarda + link de recuperación, generado
// SIN enviar correo (no se depende del correo de Supabase). El link vence según la
// configuración de Auth (por defecto 1 hora); si vence, el cliente usa «¿Olvidaste tu
// clave?» en la app con su correo real.
//
// Despliegue: verify_jwt = false (lo protege x-alpha-clave).

import { createClient } from "npm:@supabase/supabase-js@2";

const env = (k: string) => Deno.env.get(k) ?? "";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function responder(estado: number, cuerpo: Record<string, unknown>) {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { "content-type": "application/json" } });
}

function igualesSeguro(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function claveAleatoria(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return responder(405, { error: "solo POST" });
  if (!igualesSeguro(env("ALPHA_LINKS_SECRET"), req.headers.get("x-alpha-clave") ?? "")) {
    return responder(401, { error: "no autorizado" });
  }
  const cuerpo = await req.json().catch(() => ({} as Record<string, unknown>));
  const email = typeof cuerpo.email === "string" ? cuerpo.email.trim().toLowerCase() : "";
  if (!EMAIL.test(email)) return responder(400, { error: "email invalido" });

  const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Limpieza de pruebas: SOLO dominios reservados, nunca una cuenta real.
  if (cuerpo.accion === "borrar-prueba") {
    if (!email.endsWith("@invalid.test")) return responder(403, { error: "solo cuentas @invalid.test" });
    const { data } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    const id = data?.user?.id;
    if (!id) return responder(404, { error: "no existe" });
    const { error } = await admin.auth.admin.deleteUser(id);
    return error ? responder(500, { error: error.message }) : responder(200, { borrado: id });
  }

  const nombre = typeof cuerpo.nombre === "string" ? cuerpo.nombre.trim().replace(/\s+/g, " ") : "";
  if (nombre.length < 3) return responder(400, { error: "nombre invalido" });

  // 1. Crear la cuenta. Si ya existe, se sigue: el link de recuperación la encuentra.
  let nuevo = true;
  const creada = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password: claveAleatoria(),
    user_metadata: { nombre },
  });
  if (creada.error) {
    const yaExiste = /already|registered|exists/i.test(creada.error.message);
    if (!yaExiste) {
      console.error("no se pudo crear la cuenta", creada.error.message);
      return responder(500, { error: "no se pudo crear la cuenta" });
    }
    nuevo = false;
  }

  // 2. Link para crear su contraseña (tipo recuperación), sin enviar correo.
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  if (error || !data?.user?.id) {
    console.error("no se pudo generar el link", error?.message);
    return responder(500, { error: "no se pudo generar el link" });
  }
  const usuarioId = data.user.id;

  // 3. Confirmar que la app dejó su fila (la crea el trigger al_crear_usuario).
  const { data: fila } = await admin.from("usuarios_app").select("id, nombre").eq("id", usuarioId).maybeSingle();

  return responder(200, {
    usuario_id: usuarioId,
    nuevo,
    nombre_en_app: fila?.nombre ?? null,
    link: data.properties?.action_link ?? null,
  });
});
