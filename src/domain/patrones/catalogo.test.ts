import { describe, expect, it } from 'vitest'
import { normalizarCategoria, patronDeCategoria, PATRONES, PATRON_POR_ID } from './catalogo'
import { MUSCULO_POR_ID } from './musculos'
import { INDICE_HUESO } from './esqueleto'
import { RANGO } from './movimiento'

describe('el catálogo de patrones', () => {
  it('no repite identificadores ni categorías', () => {
    const ids = PATRONES.map((p) => p.id)
    const categorias = PATRONES.map((p) => normalizarCategoria(p.categoria))
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(categorias).size).toBe(categorias.length)
  })

  it('encuentra el patrón por la categoría del ejercicio, con tildes o sin ellas', () => {
    expect(patronDeCategoria('SENTADILLA')?.id).toBe('sentadilla')
    // La categoría la escriben personas distintas en sitios distintos: la que
    // llega del microciclo puede venir sin tilde o con espacios de más.
    expect(patronDeCategoria('  flexion de rodilla ')?.id).toBe('flexion_rodilla')
    expect(patronDeCategoria('FLEXIÓN DE RODILLA')?.id).toBe('flexion_rodilla')
  })

  it('devuelve undefined cuando la categoría no tiene patrón', () => {
    expect(patronDeCategoria(undefined)).toBeUndefined()
    expect(patronDeCategoria('')).toBeUndefined()
    expect(patronDeCategoria('ACONDICIONAMIENTO')).toBeUndefined()
    // «Aislamiento» no dice qué gesto es: sin patrón, y así debe quedarse.
    expect(patronDeCategoria('AISLAMIENTO')).toBeUndefined()
  })

  it('entiende el vocabulario viejo de categorías', () => {
    // Las categorías se consolidaron de 51 a 30 nombres, pero por los
    // microciclos y por el seed de demo siguen circulando los de antes. Sin
    // esto el botón del visor no sale en media sesión y parece roto.
    expect(patronDeCategoria('DOMINANTE DE CADERA')?.id).toBe('bisagra_cadera')
    expect(patronDeCategoria('DOMINANTE DE RODILLA')?.id).toBe('sentadilla')
    expect(patronDeCategoria('CORE')?.id).toBe('antiextension')
  })

  it('entiende también las categorías que nombran el músculo', () => {
    expect(patronDeCategoria('BÍCEPS')?.id).toBe('flexion_codo')
    expect(patronDeCategoria('Tríceps')?.id).toBe('extension_codo')
    expect(patronDeCategoria('gemelos')?.id).toBe('flexion_plantar')
    expect(patronDeCategoria('PECHO')?.id).toBe('empuje_horizontal')
  })

  it('no crea alias que apunten a un patrón inexistente', () => {
    // Un alias mal escrito no da error: simplemente deja de haber botón.
    for (const categoria of ['DOMINANTE DE CADERA', 'DOMINANTE DE RODILLA', 'CORE',
      'JALON', 'REMO', 'PECHO', 'HOMBRO', 'BICEPS', 'TRICEPS', 'GEMELOS',
      'ZANCADA', 'GLUTEO', 'ISQUIOS', 'CUADRICEPS', 'ESPALDA', 'BISAGRA',
      'ABDOMEN', 'DOMINADA', 'PANTORRILLA', 'PIERNA', 'EMPUJE',
      'CADENA POSTERIOR', 'UNILATERAL DE PIERNA']) {
      expect(patronDeCategoria(categoria), `alias huérfano: ${categoria}`).toBeDefined()
    }
  })

  it('no guarda cifras de uso: este repositorio es público', () => {
    // Si alguien añade "prescripciones" o "microciclos" a una ficha, el tamaño
    // de la operación acabaría publicado en el código sin que nadie lo decida.
    const prohibidos = ['prescripciones', 'presc', 'sesiones', 'microciclos', 'ses', 'mic']
    for (const p of PATRONES) {
      for (const clave of prohibidos) {
        expect(Object.hasOwn(p, clave), `${p.id} no debe llevar "${clave}"`).toBe(false)
      }
    }
  })

  it('cada ficha trae el material didáctico completo', () => {
    for (const p of PATRONES) {
      expect(p.titulo.length, p.id).toBeGreaterThan(3)
      expect(p.resumen.length, p.id).toBeGreaterThan(40)
      expect(p.ejemplos.length, p.id).toBeGreaterThan(5)
      expect(p.claves.length, p.id).toBeGreaterThanOrEqual(3)
      expect(p.errores.length, p.id).toBeGreaterThanOrEqual(2)
    }
  })

  it('solo activa músculos que existen', () => {
    for (const p of PATRONES) {
      for (const clave of Object.keys(p.activacion)) {
        const id = clave.split(':')[0]
        expect(MUSCULO_POR_ID[id], `${p.id} activa "${id}"`).toBeDefined()
      }
      // Un patrón sin agonista claro no enseña nada: siempre hay alguien al 100 %.
      const maximo = Math.max(...Object.values(p.activacion))
      expect(maximo, p.id).toBeGreaterThanOrEqual(0.9)
    }
  })

  it('usa lados válidos en la activación unilateral', () => {
    for (const p of PATRONES) {
      for (const clave of Object.keys(p.activacion)) {
        if (!clave.includes(':')) continue
        expect(['D', 'I'], `${p.id}: ${clave}`).toContain(clave.split(':')[1])
      }
    }
  })

  it('sigue un hueso que existe en el esqueleto', () => {
    for (const p of PATRONES) {
      if (!p.seguimiento) continue
      const [hueso] = p.seguimiento
      const existe = INDICE_HUESO[hueso + 'D'] !== undefined || INDICE_HUESO[hueso] !== undefined
      expect(existe, `${p.id} sigue "${hueso}"`).toBe(true)
    }
  })

  it('escribe las poses solo en canales conocidos y dentro del rango', () => {
    for (const p of PATRONES) {
      const poses = [p.inicio, p.fin, ...(p.medio ? [p.medio] : [])]
      for (const pose of poses) {
        for (const [canal, valor] of Object.entries(pose)) {
          const raiz = canal.replace(/[DI]$/, '')
          const rango = RANGO[raiz]
          expect(rango, `${p.id}: canal desconocido "${canal}"`).toBeDefined()
          expect(valor, `${p.id}: ${canal}=${valor}`).toBeGreaterThanOrEqual(rango[0])
          expect(valor, `${p.id}: ${canal}=${valor}`).toBeLessThanOrEqual(rango[1])
        }
      }
    }
  })

  it('mueve algo de verdad en cada patrón', () => {
    for (const p of PATRONES) {
      const canales = new Set([...Object.keys(p.inicio), ...Object.keys(p.fin)])
      let mayor = 0
      for (const c of canales) {
        mayor = Math.max(mayor, Math.abs((p.fin[c] ?? 0) - (p.inicio[c] ?? 0)))
      }
      const giroInicio = p.giroInicio ?? p.giro ?? [0, 0, 0]
      const giroFin = p.giroFin ?? p.giro ?? [0, 0, 0]
      const giro = Math.abs(giroFin[0] - giroInicio[0])
      // Un recorrido corto no se lee: o hay ángulo articular o hay giro de pelvis.
      expect(Math.max(mayor, giro), `${p.id} apenas se mueve`).toBeGreaterThan(25)
    }
  })

  it('indexa por id sin perder ninguno', () => {
    expect(Object.keys(PATRON_POR_ID)).toHaveLength(PATRONES.length)
  })
})
