import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OperacionPendiente } from './cola'

/**
 * Qué sale hacia Supabase cuando el asesorado registra lo que come.
 *
 * Lo que se prueba aquí no es que "sincroniza": es la FORMA exacta de lo que se
 * encola. Las dos tablas generan su id en el servidor, así que el móvil no lo
 * conoce; si el `cliente_id` o el `on_conflict` se pierden por el camino, cada
 * reintento insertaría una fila nueva y el día se duplicaría. Eso no da error en
 * pantalla: solo aparecen calorías que nadie comió.
 */

const VALENTINA = 'u-valentina'
const HOY = new Date()
const FECHA = `${HOY.getFullYear()}-${String(HOY.getMonth() + 1).padStart(2, '0')}-${String(
  HOY.getDate(),
).padStart(2, '0')}`

let modulos: { db: import('../repos').Db; cola: () => OperacionPendiente[] } | undefined

async function appEnModoNube() {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-de-prueba')
  vi.resetModules()
  const sync = await import('./sync')
  const { crearMockDb } = await import('../mockDb')
  return {
    db: sync.crearDbSincronizada(crearMockDb()),
    cola: () => JSON.parse(localStorage.getItem('alpha-cola-sync') ?? '[]') as OperacionPendiente[],
  }
}

const almuerzo = {
  usuarioId: VALENTINA,
  momentoIso: `${FECHA}T13:00:00`,
  comida: 'almuerzo' as const,
  cocinadoPorEl: true,
  aceiteG: null,
  salG: null,
  confianza: 'pesado' as const,
}

const arroz = {
  alimentoId: 'arroz-blanco-pulido-cocido-sin-sal',
  gramos: 150,
  fuePesado: true,
  estadoAsumido: 'cocido' as const,
}

describe('el registro de comidas sube a Supabase', () => {
  beforeEach(async () => {
    localStorage.clear()
    // Sin red: la cola se llena y no se drena, que es justo lo que se inspecciona.
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('sin red'))))
    modulos = await appEnModoNube()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    modulos = undefined
  })

  it('abrir una comida la encola con su id de cliente', () => {
    const { db, cola } = modulos!
    db.registroComidas.abrirComida(almuerzo)

    const [op] = cola()
    expect(op.tabla).toBe('registro_comida')
    expect(op.tipo).toBe('upsert')
    expect(op.payload.cliente_id).toBeTruthy()
    expect(op.payload.asesorado_id).toBe(VALENTINA)
  })

  it('el upsert resuelve el conflicto por cliente_id, no por la clave primaria', () => {
    // Sin esto, cada reintento insertaría una comida nueva: el `id` lo genera
    // el servidor y el móvil nunca lo manda.
    const { db, cola } = modulos!
    db.registroComidas.abrirComida(almuerzo)
    expect(cola()[0].onConflict).toBe('cliente_id')
  })

  it('el ítem viaja apuntando a su comida por el id de cliente', () => {
    const { db, cola } = modulos!
    const comidaId = db.registroComidas.abrirComida(almuerzo)
    db.registroComidas.agregarItem(VALENTINA, comidaId, arroz)

    const item = cola().find((o) => o.tabla === 'registro_item')
    expect(item?.payload.comida_cliente_id).toBe(comidaId)
    expect(item?.payload.gramos).toBe(150)
    expect(item?.onConflict).toBe('cliente_id')
  })

  it('la comida va SIEMPRE antes que sus ítems', () => {
    // El trigger de la base resuelve la comida del ítem al insertarlo: si el
    // ítem llegara primero, no la encontraría y lo rechazaría.
    const { db, cola } = modulos!
    const comidaId = db.registroComidas.abrirComida(almuerzo)
    db.registroComidas.agregarItem(VALENTINA, comidaId, arroz)

    expect(cola().map((o) => o.tabla)).toEqual(['registro_comida', 'registro_item'])
  })

  it('editar la misma comida cinco veces deja UN upsert, no cinco', () => {
    const { db, cola } = modulos!
    const comidaId = db.registroComidas.abrirComida(almuerzo)
    for (const aceiteG of [7, 14, 21, 28, 42]) {
      db.registroComidas.editarComida(VALENTINA, comidaId, { aceiteG })
    }

    const comidas = cola().filter((o) => o.tabla === 'registro_comida')
    expect(comidas).toHaveLength(1)
    expect(comidas[0].payload.aceite_g).toBe(42)
  })

  describe('quitar cosas', () => {
    it('un ítem se marca borrado, no se borra', () => {
      // La cola no sabe hacer `delete`. Y el rastro es información real: el
      // coach puede ver que algo se anotó y se quitó.
      const { db, cola } = modulos!
      const comidaId = db.registroComidas.abrirComida(almuerzo)
      db.registroComidas.agregarItem(VALENTINA, comidaId, arroz)
      const [item] = db.registroComidas.delDia(VALENTINA, FECHA)[0].items

      db.registroComidas.quitarItem(VALENTINA, comidaId, item.id)

      const borrado = cola().find((o) => o.tipo === 'update' && o.tabla === 'registro_item')
      expect(borrado?.payload.borrado).toBe(true)
      expect(borrado?.filtro?.cliente_id).toBe(item.id)
    })

    it('una comida entera también', () => {
      const { db, cola } = modulos!
      const comidaId = db.registroComidas.abrirComida(almuerzo)
      db.registroComidas.borrarComida(VALENTINA, comidaId)

      const borrado = cola().find((o) => o.tipo === 'update' && o.tabla === 'registro_comida')
      expect(borrado?.payload.borrado).toBe(true)
      expect(borrado?.filtro?.cliente_id).toBe(comidaId)
    })
  })

  it('la preferencia de crudo o cocido también sube', () => {
    const { db, cola } = modulos!
    db.registroComidas.recordarPreferencia({
      usuarioId: VALENTINA,
      familia: 'arroz',
      estado: 'cocido',
    })

    const op = cola().find((o) => o.tabla === 'preferencia_estado')
    expect(op?.payload).toMatchObject({ asesorado_id: VALENTINA, familia: 'arroz', estado: 'cocido' })
  })

  describe('cuando las migraciones todavía no están aplicadas', () => {
    beforeEach(() => localStorage.setItem('alpha-tablas-registro', '0'))

    it('no encola nada, para no quemar los reintentos', () => {
      // Sin este freno, cada alimento anotado fallaría ocho veces y acabaría
      // descartado. El asesorado no vería ningún error: seguiría registrando
      // con normalidad mientras su día se evapora en la cola.
      const { db, cola } = modulos!
      const comidaId = db.registroComidas.abrirComida(almuerzo)
      db.registroComidas.agregarItem(VALENTINA, comidaId, arroz)

      expect(cola()).toEqual([])
    })

    it('pero el registro se guarda en el dispositivo igual', () => {
      const { db } = modulos!
      const comidaId = db.registroComidas.abrirComida(almuerzo)
      db.registroComidas.agregarItem(VALENTINA, comidaId, arroz)

      expect(db.registroComidas.delDia(VALENTINA, FECHA)[0].items).toHaveLength(1)
    })
  })

  describe('la encuesta de nutrición', () => {
    const encuesta = { genero: 'M', pesoKg: 56, alergias: ['lacteos'], cicloMenstrual: 'irregular' }

    it('a medias NO sube: el perfil se lee entero o no se lee', () => {
      const { db, cola } = modulos!
      db.perfilNutricion.guardar(VALENTINA, encuesta, false)
      expect(cola().filter((o) => o.tabla === 'perfil_alimentario')).toEqual([])
    })

    it('al terminarla sube, con las respuestas en crudo', () => {
      const { db, cola } = modulos!
      db.perfilNutricion.guardar(VALENTINA, encuesta, true)

      const op = cola().find((o) => o.tabla === 'perfil_alimentario')
      expect(op?.payload.asesorado_id).toBe(VALENTINA)
      expect(op?.payload.respuestas).toMatchObject(encuesta)
      expect(op?.payload.completada_en).toBeTruthy()
    })

    it('y con las columnas que se consultan, proyectadas del crudo', () => {
      // El jsonb es la fuente de verdad; estas columnas existen para poder
      // preguntar "quiénes no comen lácteos" sin abrir el jsonb de cada uno.
      const { db, cola } = modulos!
      db.perfilNutricion.guardar(VALENTINA, encuesta, true)

      const op = cola().find((o) => o.tabla === 'perfil_alimentario')
      expect(op?.payload.alergias).toEqual(['lacteos'])
      expect(op?.payload.ciclo_menstrual).toBe('irregular')
    })

    it('un texto libre entra como lista de un elemento, sin trocearlo', () => {
      // "no consigo salmón ni arándanos" es UNA respuesta. Partirla por comas
      // que la persona no puso sería inventarse una estructura.
      const { db, cola } = modulos!
      db.perfilNutricion.guardar(VALENTINA, { sinAcceso: 'salmón, arándanos' }, true)

      const op = cola().find((o) => o.tabla === 'perfil_alimentario')
      expect(op?.payload.sin_acceso).toEqual(['salmón, arándanos'])
    })

    it('lo que no se respondió entra como null, no como lista vacía', () => {
      // Mateo no tiene perfil en el seed: `guardar` fusiona con lo previo, así
      // que hace falta alguien que empiece de cero para ver los huecos.
      const { db, cola } = modulos!
      db.perfilNutricion.guardar('u-mateo', { genero: 'H' }, true)

      const op = cola().find((o) => o.tabla === 'perfil_alimentario')
      expect(op?.payload.alergias).toBeNull()
      expect(op?.payload.come_visceras).toBeNull()
    })
  })

  it('lo local se guarda aunque no haya red', () => {
    // El registro no depende de que la subida funcione. Es lo que permite
    // anotar en un sótano sin cobertura.
    const { db } = modulos!
    const comidaId = db.registroComidas.abrirComida(almuerzo)
    db.registroComidas.agregarItem(VALENTINA, comidaId, arroz)

    expect(db.registroComidas.delDia(VALENTINA, FECHA)[0].items).toHaveLength(1)
  })
})
