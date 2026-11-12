// La puerta de entrada de la landing al tablero de creadores (11-nov-2026).
//
// POR QUÉ EXISTE. El tablero de creadores (`creadores_candidatos`, 0090) hoy solo lo llena el
// importador de casa (`bola-de-nieve/tablero/subir_creadores.py`), que descubre creadores en
// Instagram. La landing pública va a tener su propio PRAXIS (agente conversacional) para que un
// creador se postule solo; cuando complete ese formulario conversado, la landing llama a esta
// función para que el candidato entre al MISMO tablero, con `origen = 'landing-praxis'`, sin
// tocar el importador. Mismo patrón que `cadena-agentes`: HTTPS, una clave en cabecera y una
// sola RPC de la migración (`creadores_landing_registrar`, 0178) — sin SQL libre.
//
// POST { usuario_ig, nicho?, ciudad?, rango_seguidores?, ya_crea_contenido?, contacto_tipo,
//        contacto, mayor_edad }   cabecera obligatoria x-alpha-clave = ALPHA_CREADORES_SECRET
//   -> 200 { ok: true, datos: { creador_id, es_nuevo } }
//   -> 400 / 401 / 500 { ok: false, error }
//
// LO QUE NO DEJA HACER, a propósito:
//   · No hay SQL libre: la única acción es `creadores_landing_registrar`.
//   · `mayor_edad` tiene que ser literalmente `true`: cualquier otra cosa (ausente, `false`,
//     `"true"`…) se rechaza con 400 antes de llamar a la base. La función de la base repite el
//     candado como última línea de defensa.
//   · Un @ que ya existe no se duplica ni se pisa: la RPC solo anota el contacto nuevo.
//   · No hay límite de tasa propio aquí: Supabase Edge Functions no lo trae de fábrica y no es
//     tarea de esta función — el límite lo pone el lado de la landing antes de llamar.
//
// Despliegue (lo hace Bryan):
//   supabase functions deploy creadores-landing --no-verify-jwt --project-ref sbzmbiwrnvegrticatza
// Usa SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (los trae el entorno) y ALPHA_CREADORES_SECRET,
// un secreto PROPIO (no reutilizar ALPHA_LINKS_SECRET ni ALPHA_CADENA_SECRET): quien tenga esta
// clave solo puede dar de alta o anotar un contacto de creador, nada más.

import { createClient } from "npm:@supabase/supabase-js@2";
import { atender, type Rpc } from "./logica.ts";

const env = (k: string) => Deno.env.get(k) ?? "";

const sb = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const rpc: Rpc = async (nombre, args) => {
  const { data, error } = await sb.rpc(nombre, args ?? {});
  return { data, error: error ? { message: error.message } : null };
};

Deno.serve(async (req) => {
  const r = await atender(
    req.method,
    req.headers.get("x-alpha-clave") ?? "",
    env("ALPHA_CREADORES_SECRET"),
    () => req.json(),
    rpc,
    (texto) => console.error("creadores-landing:", texto),
  );
  return new Response(JSON.stringify(r.cuerpo), {
    status: r.estado,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
});
