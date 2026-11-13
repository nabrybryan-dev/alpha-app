// La lógica de `creadores-landing`, sin Deno ni red: se prueba con vitest (logica.test.ts).
// index.ts solo la conecta con Deno.serve y con el cliente de Supabase.

const USUARIO_IG = /^[a-z0-9._]{1,30}$/;
const RANGOS = ["menos_10k", "10k_50k", "50k_200k", "mas_200k"] as const;
const CONTACTOS = ["whatsapp", "correo"] as const;

export type RangoSeguidores = (typeof RANGOS)[number];
export type ContactoTipo = (typeof CONTACTOS)[number];

export type Rpc = (nombre: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
export type Respuesta = { estado: number; cuerpo: Record<string, unknown> };

export type CuerpoRegistro = {
  usuario_ig: string;
  nicho: string | null;
  ciudad: string | null;
  rango_seguidores: RangoSeguidores | null;
  ya_crea_contenido: boolean | null;
  // Con declina = true, contacto_tipo y contacto son null: declinar es "lo mínimo", sin
  // contacto. La RPC los ignora aunque lleguen, pero esta función ya no los exige.
  contacto_tipo: ContactoTipo | null;
  contacto: string | null;
  mayor_edad: true;
  declina: boolean;
};

type Validacion = { ok: true; datos: CuerpoRegistro } | { ok: false; error: string };

const bien = (datos: unknown): Respuesta => ({ estado: 200, cuerpo: { ok: true, datos } });
const mal = (estado: number, error: string): Respuesta => ({ estado, cuerpo: { ok: false, error } });

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

async function llamar(rpc: Rpc, nombre: string, args?: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await rpc(nombre, args);
  if (error) throw new Error(`${nombre}: ${error.message}`);
  return data;
}

/** El @ tal como lo escribió en el chat: sin espacios, sin @ y en minúsculas. La forma final la
 *  exige USUARIO_IG; esto solo limpia lo que un humano teclea sin pensarlo. */
function normalizarUsuarioIg(valor: unknown): string {
  if (typeof valor !== "string") return "";
  return valor.replace(/\s+/g, "").replace(/^@+/, "").toLowerCase();
}

/** Recorta a `maximo` caracteres; cadena vacía o valor que no es string se vuelve null. */
function recortar(valor: unknown, maximo: number): string | null {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim();
  return limpio.length > 0 ? limpio.slice(0, maximo) : null;
}

/** Valida el cuerpo del POST. `mayor_edad` tiene que ser literalmente `true`: cualquier otra
 *  cosa (ausente, `false`, `"true"`…) es un rechazo, porque esta puerta nunca guarda a quien no
 *  confirmó ser mayor de edad. */
export function validarCuerpo(cuerpo: unknown): Validacion {
  const c = (cuerpo && typeof cuerpo === "object" && !Array.isArray(cuerpo) ? cuerpo : {}) as Record<string, unknown>;

  const usuario_ig = normalizarUsuarioIg(c.usuario_ig);
  if (!USUARIO_IG.test(usuario_ig)) return { ok: false, error: "usuario_ig inválido" };

  // Declina = true: "se guarda solo lo mínimo y no se vuelve a contactar" — sin contacto.
  const declina = c.declina === true;

  let contacto_tipo: ContactoTipo | null = null;
  let contacto: string | null = null;
  if (!declina) {
    if (typeof c.contacto_tipo !== "string" || !CONTACTOS.includes(c.contacto_tipo as ContactoTipo)) {
      return { ok: false, error: "contacto_tipo inválido" };
    }
    contacto_tipo = c.contacto_tipo as ContactoTipo;

    contacto = recortar(c.contacto, 200);
    if (!contacto) return { ok: false, error: "contacto obligatorio" };
  }

  if (c.mayor_edad !== true) return { ok: false, error: "se requiere mayor_edad" };

  let rango_seguidores: RangoSeguidores | null = null;
  if (c.rango_seguidores != null) {
    if (typeof c.rango_seguidores !== "string" || !RANGOS.includes(c.rango_seguidores as RangoSeguidores)) {
      return { ok: false, error: "rango_seguidores inválido" };
    }
    rango_seguidores = c.rango_seguidores as RangoSeguidores;
  }

  const ya_crea_contenido = typeof c.ya_crea_contenido === "boolean" ? c.ya_crea_contenido : null;

  return {
    ok: true,
    datos: {
      usuario_ig,
      // Declina: ni nicho, ni ciudad, ni rango, ni ya_crea_contenido — "lo mínimo" es el @.
      nicho: declina ? null : recortar(c.nicho, 120),
      ciudad: declina ? null : recortar(c.ciudad, 120),
      rango_seguidores: declina ? null : rango_seguidores,
      ya_crea_contenido: declina ? null : ya_crea_contenido,
      contacto_tipo,
      contacto,
      mayor_edad: true,
      declina,
    },
  };
}

/** Valida y llama a la única RPC de este camino: sin SQL libre, igual que cadena-agentes. */
export async function despachar(cuerpo: unknown, rpc: Rpc): Promise<Respuesta> {
  const validado = validarCuerpo(cuerpo);
  if (!validado.ok) return mal(400, validado.error);
  const d = validado.datos;
  const data = await llamar(rpc, "creadores_landing_registrar", {
    p_usuario_ig: d.usuario_ig,
    p_nicho: d.nicho,
    p_ciudad: d.ciudad,
    p_rango_seguidores: d.rango_seguidores,
    p_ya_crea_contenido: d.ya_crea_contenido,
    p_contacto_tipo: d.contacto_tipo,
    p_contacto: d.contacto,
    p_mayor_edad: d.mayor_edad,
    p_declina: d.declina,
  });
  return bien(data);
}

/** La petición entera: método, clave, JSON y errores de la base sin filtrar detalles. */
export async function atender(
  metodo: string,
  claveRecibida: string,
  claveEsperada: string,
  leerJson: () => Promise<unknown>,
  rpc: Rpc,
  registrar: (texto: string) => void = () => {},
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
    return await despachar(cuerpo, rpc);
  } catch (e) {
    const texto = e instanceof Error ? e.message : String(e);
    registrar(texto);
    return mal(500, "fallo en la base");
  }
}
