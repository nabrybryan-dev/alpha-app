import { describe, expect, it } from 'vitest'
import { atender, claveValida, despachar, validarCuerpo, type Rpc } from './logica'

type Llamada = { nombre: string; args?: Record<string, unknown> }

function rpcFalso(respuestas: Record<string, unknown> = {}) {
  const llamadas: Llamada[] = []
  const rpc: Rpc = async (nombre, args) => {
    llamadas.push({ nombre, args })
    const r = respuestas[nombre]
    if (r instanceof Error) return { data: null, error: { message: r.message } }
    return { data: r ?? null, error: null }
  }
  return { rpc, llamadas }
}

const CUERPO_VALIDO = {
  usuario_ig: '@Cuenta_De_Prueba',
  nicho: 'fitness',
  ciudad: 'Bogotá',
  rango_seguidores: '10k_50k',
  ya_crea_contenido: true,
  contacto_tipo: 'whatsapp',
  contacto: '+570000000',
  mayor_edad: true,
}

describe('validarCuerpo', () => {
  it('acepta un cuerpo completo y normaliza el usuario_ig (quita @, espacios, minúsculas)', () => {
    const r = validarCuerpo(CUERPO_VALIDO)
    expect(r).toEqual({
      ok: true,
      datos: {
        usuario_ig: 'cuenta_de_prueba',
        nicho: 'fitness',
        ciudad: 'Bogotá',
        rango_seguidores: '10k_50k',
        ya_crea_contenido: true,
        contacto_tipo: 'whatsapp',
        contacto: '+570000000',
        mayor_edad: true,
        declina: false,
      },
    })
  })

  it('acepta un cuerpo mínimo: solo lo obligatorio', () => {
    const r = validarCuerpo({ usuario_ig: 'cuenta_de_prueba', contacto_tipo: 'correo', contacto: 'a@b.test', mayor_edad: true })
    expect(r).toEqual({
      ok: true,
      datos: {
        usuario_ig: 'cuenta_de_prueba',
        nicho: null,
        ciudad: null,
        rango_seguidores: null,
        ya_crea_contenido: null,
        contacto_tipo: 'correo',
        contacto: 'a@b.test',
        mayor_edad: true,
        declina: false,
      },
    })
  })

  describe('declina (no se le vuelve a contactar, se guarda solo lo mínimo)', () => {
    it('con declina: true no exige contacto_tipo ni contacto, y limpia el resto del perfil', () => {
      const r = validarCuerpo({
        usuario_ig: '@Cuenta_De_Prueba',
        nicho: 'fitness',
        ciudad: 'Bogotá',
        rango_seguidores: '10k_50k',
        ya_crea_contenido: true,
        mayor_edad: true,
        declina: true,
      })
      expect(r).toEqual({
        ok: true,
        datos: {
          usuario_ig: 'cuenta_de_prueba',
          nicho: null,
          ciudad: null,
          rango_seguidores: null,
          ya_crea_contenido: null,
          contacto_tipo: null,
          contacto: null,
          mayor_edad: true,
          declina: true,
        },
      })
    })

    it('con declina: true SIGUE exigiendo mayor_edad === true', () => {
      expect(validarCuerpo({ usuario_ig: 'cuenta_de_prueba', mayor_edad: false, declina: true })).toEqual({
        ok: false,
        error: 'se requiere mayor_edad',
      })
    })

    it('un declina que además manda contacto lo ignora (queda null en los datos validados)', () => {
      const r = validarCuerpo({ ...CUERPO_VALIDO, declina: true })
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.datos.contacto).toBeNull()
        expect(r.datos.contacto_tipo).toBeNull()
      }
    })

    it('declina ausente o con cualquier valor que no sea true === false', () => {
      for (const declina of [undefined, null, 'true', 1, false]) {
        const r = validarCuerpo({ ...CUERPO_VALIDO, declina })
        expect(r.ok).toBe(true)
        if (r.ok) expect(r.datos.declina).toBe(false)
      }
    })
  })

  it('recorta nicho, ciudad y contacto a su tope de caracteres', () => {
    const r = validarCuerpo({
      ...CUERPO_VALIDO,
      nicho: 'n'.repeat(200),
      ciudad: 'c'.repeat(200),
      contacto: 'd'.repeat(300),
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.datos.nicho).toHaveLength(120)
      expect(r.datos.ciudad).toHaveLength(120)
      expect(r.datos.contacto).toHaveLength(200)
    }
  })

  it.each([
    [undefined, 'usuario_ig inválido'],
    ['', 'usuario_ig inválido'],
    ['@', 'usuario_ig inválido'],
    ['cuenta con espacio y símbolo!', 'usuario_ig inválido'],
    ['x'.repeat(31), 'usuario_ig inválido'],
  ])('rechaza usuario_ig inválido: %p', (usuario_ig, error) => {
    expect(validarCuerpo({ ...CUERPO_VALIDO, usuario_ig })).toEqual({ ok: false, error })
  })

  it.each([
    [undefined],
    [null],
    ['telegram'],
    [123],
  ])('rechaza contacto_tipo que no sea whatsapp ni correo: %p', (contacto_tipo) => {
    expect(validarCuerpo({ ...CUERPO_VALIDO, contacto_tipo })).toEqual({ ok: false, error: 'contacto_tipo inválido' })
  })

  it.each([
    [undefined],
    [null],
    [''],
    ['   '],
  ])('rechaza contacto ausente o vacío: %p', (contacto) => {
    expect(validarCuerpo({ ...CUERPO_VALIDO, contacto })).toEqual({ ok: false, error: 'contacto obligatorio' })
  })

  it.each([
    [undefined],
    [false],
    ['true'],
    [1],
  ])('NUNCA guarda a quien no confirmó mayor_edad === true: %p', (mayor_edad) => {
    expect(validarCuerpo({ ...CUERPO_VALIDO, mayor_edad })).toEqual({ ok: false, error: 'se requiere mayor_edad' })
  })

  it('rechaza rango_seguidores que no es uno de los cuatro valores cerrados', () => {
    expect(validarCuerpo({ ...CUERPO_VALIDO, rango_seguidores: 'un_millon' })).toEqual({
      ok: false,
      error: 'rango_seguidores inválido',
    })
  })

  it('rango_seguidores null o ausente se acepta como null', () => {
    expect(validarCuerpo({ ...CUERPO_VALIDO, rango_seguidores: null }).ok).toBe(true)
    const resto: Record<string, unknown> = { ...CUERPO_VALIDO }
    delete resto.rango_seguidores
    expect(validarCuerpo(resto).ok).toBe(true)
  })

  it('ya_crea_contenido que no es boolean se vuelve null en vez de rechazar', () => {
    const r = validarCuerpo({ ...CUERPO_VALIDO, ya_crea_contenido: 'si' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.datos.ya_crea_contenido).toBeNull()
  })

  it('un cuerpo que no es objeto (array, null, string) se trata como vacío y falla por usuario_ig', () => {
    for (const cuerpo of [null, [], 'texto', 42]) {
      expect(validarCuerpo(cuerpo)).toEqual({ ok: false, error: 'usuario_ig inválido' })
    }
  })
})

describe('claveValida', () => {
  it('coincide cuando ambos lados son iguales', async () => {
    expect(await claveValida('secreto-1', 'secreto-1')).toBe(true)
  })

  it('no coincide con una clave distinta', async () => {
    expect(await claveValida('secreto-1', 'secreto-2')).toBe(false)
  })

  it('nunca es válida con un lado vacío, aunque el otro también lo sea', async () => {
    expect(await claveValida('', '')).toBe(false)
    expect(await claveValida('secreto-1', '')).toBe(false)
    expect(await claveValida('', 'secreto-1')).toBe(false)
  })
})

describe('despachar', () => {
  it('en éxito llama la RPC con los p_ en orden y devuelve ok + datos', async () => {
    const { rpc, llamadas } = rpcFalso({ creadores_landing_registrar: { creador_id: 'land:cuenta_de_prueba', es_nuevo: true } })
    const r = await despachar(CUERPO_VALIDO, rpc)
    expect(r).toEqual({ estado: 200, cuerpo: { ok: true, datos: { creador_id: 'land:cuenta_de_prueba', es_nuevo: true } } })
    expect(llamadas).toEqual([{
      nombre: 'creadores_landing_registrar',
      args: {
        p_usuario_ig: 'cuenta_de_prueba',
        p_nicho: 'fitness',
        p_ciudad: 'Bogotá',
        p_rango_seguidores: '10k_50k',
        p_ya_crea_contenido: true,
        p_contacto_tipo: 'whatsapp',
        p_contacto: '+570000000',
        p_mayor_edad: true,
        p_declina: false,
      },
    }])
  })

  it('con declina: true manda p_declina: true y p_contacto(_tipo) en null', async () => {
    const { rpc, llamadas } = rpcFalso({ creadores_landing_registrar: { creador_id: 'land:cuenta_de_prueba', es_nuevo: true, no_contactar: true } })
    const r = await despachar({ usuario_ig: 'cuenta_de_prueba', mayor_edad: true, declina: true }, rpc)
    expect(r).toEqual({ estado: 200, cuerpo: { ok: true, datos: { creador_id: 'land:cuenta_de_prueba', es_nuevo: true, no_contactar: true } } })
    expect(llamadas).toEqual([{
      nombre: 'creadores_landing_registrar',
      args: {
        p_usuario_ig: 'cuenta_de_prueba',
        p_nicho: null,
        p_ciudad: null,
        p_rango_seguidores: null,
        p_ya_crea_contenido: null,
        p_contacto_tipo: null,
        p_contacto: null,
        p_mayor_edad: true,
        p_declina: true,
      },
    }])
  })

  it('con un cuerpo inválido no llama la RPC', async () => {
    const { rpc, llamadas } = rpcFalso()
    const r = await despachar({ ...CUERPO_VALIDO, mayor_edad: false }, rpc)
    expect(r).toEqual({ estado: 400, cuerpo: { ok: false, error: 'se requiere mayor_edad' } })
    expect(llamadas).toEqual([])
  })
})

describe('atender', () => {
  it('rechaza un método que no es POST sin leer el cuerpo ni tocar la base', async () => {
    const { rpc, llamadas } = rpcFalso()
    const r = await atender('GET', 'k', 'k', async () => CUERPO_VALIDO, rpc)
    expect(r).toEqual({ estado: 405, cuerpo: { ok: false, error: 'solo POST' } })
    expect(llamadas).toEqual([])
  })

  it('con la clave equivocada no llega a la base', async () => {
    const { rpc, llamadas } = rpcFalso()
    const r = await atender('POST', 'mala', 'buena', async () => CUERPO_VALIDO, rpc)
    expect(r).toEqual({ estado: 401, cuerpo: { ok: false, error: 'no autorizado' } })
    expect(llamadas).toEqual([])
  })

  it('un JSON que no parsea da 400 sin tocar la base', async () => {
    const { rpc, llamadas } = rpcFalso()
    const r = await atender('POST', 'k', 'k', async () => { throw new SyntaxError('bad json') }, rpc)
    expect(r).toEqual({ estado: 400, cuerpo: { ok: false, error: 'JSON inválido' } })
    expect(llamadas).toEqual([])
  })

  it('en éxito devuelve 200 con ok true y los datos de la RPC', async () => {
    const { rpc } = rpcFalso({ creadores_landing_registrar: { creador_id: 'land:cuenta_de_prueba', es_nuevo: false } })
    const r = await atender('POST', 'k', 'k', async () => CUERPO_VALIDO, rpc)
    expect(r).toEqual({ estado: 200, cuerpo: { ok: true, datos: { creador_id: 'land:cuenta_de_prueba', es_nuevo: false } } })
  })

  it('si la RPC lanza, responde 500 genérico y manda el detalle solo al log', async () => {
    const { rpc } = rpcFalso({ creadores_landing_registrar: new Error('creadores_landing_registrar: algo interno') })
    const textos: string[] = []
    const r = await atender('POST', 'k', 'k', async () => CUERPO_VALIDO, rpc, (t) => textos.push(t))
    expect(r).toEqual({ estado: 500, cuerpo: { ok: false, error: 'fallo en la base' } })
    expect(textos).toEqual(['creadores_landing_registrar: creadores_landing_registrar: algo interno'])
  })

  it('una validación inválida en el cuerpo real llega como 400, no como 500', async () => {
    const { rpc, llamadas } = rpcFalso()
    const r = await atender('POST', 'k', 'k', async () => ({ ...CUERPO_VALIDO, usuario_ig: '' }), rpc)
    expect(r).toEqual({ estado: 400, cuerpo: { ok: false, error: 'usuario_ig inválido' } })
    expect(llamadas).toEqual([])
  })
})
