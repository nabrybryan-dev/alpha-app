// La lógica de `cadena-agentes`, sin Deno ni red: se prueba con vitest (logica.test.ts).
// index.ts solo la conecta con Deno.serve y con el cliente de Supabase.

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID_CUESTIONARIO = /^preg-[\p{L}\p{N}._:-]{1,195}$/u;
const MAX_DATOS = 64 * 1024;
const MAX_ASIGNADOS = 20;
const ORIGEN = /^[a-z0-9][a-z0-9-]{1,39}$/;
const MAX_DETALLE = 4 * 1024;
/** Minutos sin latido para dar un origen por caído (0173). */
export const MINUTOS_SIN_LATIDO = 30;

export type Rpc = (nombre: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
export type Respuesta = { estado: number; cuerpo: Record<string, unknown> };
/** Manda un aviso (Telegram, en index.ts). `true` solo si salió: si no, no se marca y se reintenta. */
export type Avisar = (texto: string) => Promise<boolean>;
const sinAviso: Avisar = () => Promise.resolve(false);

const bien = (cuerpo: Record<string, unknown>): Respuesta => ({ estado: 200, cuerpo });
const mal = (estado: number, error: string): Respuesta => ({ estado, cuerpo: { error } });

/** Compara la clave en tiempo constante: los dos lados se resumen a 32 bytes con SHA-256, así
 *  ni la longitud ni el primer byte distinto cambian el tiempo. Sin secreto configurado, nunca. */
export async function claveValida(esperada: string, recibida: string): Promise<boolean> {
  if (!esperada || !recibida) return false;
  const cod = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", cod.encode(esperada)),
    crypto.subtle.digest("SHA-256", cod.encode(recibida)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

const filas = (data: unknown): unknown[] => (Array.isArray(data) ? data : data == null ? [] : [data]);

async function llamar(rpc: Rpc, nombre: string, args?: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await rpc(nombre, args);
  if (error) throw new Error(`${nombre}: ${error.message}`);
  return data;
}

function validarCuestionario(c: Record<string, unknown>): string | null {
  if (typeof c.id !== "string" || !ID_CUESTIONARIO.test(c.id)) return "id de cuestionario inválido";
  const d = c.datos;
  if (!d || typeof d !== "object" || Array.isArray(d)) return "datos tiene que ser un objeto";
  if (JSON.stringify(d).length > MAX_DATOS) return "datos demasiado grande";
  const a = c.asignado_a;
  if (!Array.isArray(a) || a.length < 1 || a.length > MAX_ASIGNADOS) return "asignado_a: de 1 a 20 usuarios";
  if (!a.every((x) => typeof x === "string" && UUID.test(x))) return "asignado_a: solo uuid";
  return null;
}

function validarLatido(c: Record<string, unknown>): string | null {
  if (typeof c.origen !== "string" || !ORIGEN.test(c.origen)) return "origen inválido";
  const d = c.detalle;
  if (d === undefined) return null;
  if (!d || typeof d !== "object" || Array.isArray(d)) return "detalle tiene que ser un objeto";
  if (JSON.stringify(d).length > MAX_DETALLE) return "detalle demasiado grande";
  return null;
}

type Cambio = { origen: string; cambio: "caido" | "volvio"; visto_en: string; minutos: number };

const esCambio = (f: unknown): f is Cambio => {
  const x = f as Partial<Cambio> | null;
  return !!x && typeof x.origen === "string" && (x.cambio === "caido" || x.cambio === "volvio");
};

/** El texto del aviso. Solo el origen y los minutos: nada de nadie. */
export function textoLatido(c: Cambio): string {
  return c.cambio === "caido"
    ? `Cadena de agentes: «${c.origen}» no da señales desde hace ${c.minutos} min. Revisa que el ASUS esté encendido, despierto y con internet, y que el n8n corra.`
    : `Cadena de agentes: «${c.origen}» volvió a dar señales.`;
}

/** Cada cambio pendiente: un aviso y, solo si salió, la marca. Un fallo no corta a los demás. */
async function vigilarLatidos(rpc: Rpc, avisar: Avisar): Promise<Respuesta> {
  const pendientes = filas(await llamar(rpc, "cadena_latidos_por_avisar", { p_minutos: MINUTOS_SIN_LATIDO })).filter(esCambio);
  const rows: { origen: string; cambio: string; avisado: boolean }[] = [];
  for (const c of pendientes) {
    const avisado = await avisar(textoLatido(c)).catch(() => false);
    if (avisado) {
      await llamar(rpc, "cadena_latido_avisado", { p_origen: c.origen, p_estado: c.cambio === "caido" ? "caido" : "vivo" });
    }
    rows.push({ origen: c.origen, cambio: c.cambio, avisado });
  }
  return bien({ rows });
}

/** Acciones de solo lectura sin parámetros: acción -> RPC. */
const LECTURAS: Record<string, string> = {
  salud: "cadena_salud",
  altas_pendientes: "cadena_altas_pendientes",
  respuestas_preg: "cadena_respuestas_preg",
  canario_restos: "cadena_canario_restos",
};

/** Acciones del canario sobre UN usuario: la RPC rechaza a quien no es canario. */
const CANARIO: Record<string, string> = {
  canario_estado: "cadena_canario_estado",
  canario_proponer: "cadena_canario_proponer",
  canario_borrar: "cadena_canario_borrar",
};

export const ACCIONES = [...Object.keys(LECTURAS), "insertar_cuestionario", ...Object.keys(CANARIO), "latido", "vigilar_latidos"];

/** Despacha UNA acción. No hay SQL libre: cada acción es una RPC de la migración. */
export async function despachar(cuerpo: unknown, rpc: Rpc, avisar: Avisar = sinAviso): Promise<Respuesta> {
  const c = (cuerpo && typeof cuerpo === "object" && !Array.isArray(cuerpo) ? cuerpo : {}) as Record<string, unknown>;
  const accion = typeof c.accion === "string" ? c.accion : "";

  if (Object.hasOwn(LECTURAS, accion)) {
    return bien({ rows: filas(await llamar(rpc, LECTURAS[accion])) });
  }
  if (accion === "insertar_cuestionario") {
    const motivo = validarCuestionario(c);
    if (motivo) return mal(400, motivo);
    const data = await llamar(rpc, "cadena_insertar_cuestionario", {
      p_id: c.id, p_datos: c.datos, p_asignado: c.asignado_a,
    });
    return bien({ rows: filas(data) });
  }
  if (Object.hasOwn(CANARIO, accion)) {
    const uid = typeof c.usuario_id === "string" ? c.usuario_id : "";
    if (!UUID.test(uid)) return mal(400, "usuario_id inválido");
    return bien({ rows: filas(await llamar(rpc, CANARIO[accion], { p_usuario: uid })) });
  }
  if (accion === "latido") {
    const motivo = validarLatido(c);
    if (motivo) return mal(400, motivo);
    return bien({ rows: filas(await llamar(rpc, "cadena_latido", { p_origen: c.origen, p_detalle: c.detalle ?? {} })) });
  }
  if (accion === "vigilar_latidos") return vigilarLatidos(rpc, avisar);
  return mal(400, "acción desconocida");
}

/** La petición entera: método, clave, JSON y errores de la base sin filtrar detalles. */
export async function atender(
  metodo: string, claveRecibida: string, claveEsperada: string, leerJson: () => Promise<unknown>, rpc: Rpc,
  registrar: (texto: string) => void = () => {},
  avisar: Avisar = sinAviso,
): Promise<Respuesta> {
  if (metodo !== "POST") return mal(405, "solo POST");
  if (!(await claveValida(claveEsperada, claveRecibida))) return mal(401, "no autorizado");
  let cuerpo: unknown;
  try {
    cuerpo = await leerJson();
  } catch {
    return mal(400, "JSON inválido");
  }
  try {
    return await despachar(cuerpo, rpc, avisar);
  } catch (e) {
    const texto = e instanceof Error ? e.message : String(e);
    registrar(texto);
    // 42501 = no es un canario: se dice, sin el detalle de la base.
    if (/no es un canario/.test(texto)) return mal(403, "no es un canario");
    return mal(500, "fallo en la base");
  }
}
