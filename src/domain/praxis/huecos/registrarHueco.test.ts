import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { normalizarHueco } from '../charla/hueco.ts'
import { ESTADOS_HUECO, registrarHueco, type HuecoExistente } from './registrarHueco.ts'

const T0 = new Date('2026-11-12T10:00:00Z')
const T1 = new Date('2026-11-12T11:30:00Z')
const hueco = normalizarHueco('¿cuántas series por semana para el pecho?')

describe('registrarHueco', () => {
  it('tema nuevo: fila con conteo 1, estado nuevo y las dos fechas iguales', () => {
    const f = registrarHueco(hueco, null, T0)
    expect(f).toEqual({ tema_clave: hueco.temaClave, frase_limpia: hueco.frase, conteo: 1, primera_vez: T0.toISOString(), ultima_vez: T0.toISOString(), estado: 'nuevo' })
  })

  it('tema que ya existe: el conteo sube en uno, se conservan frase y primera vez, la última se actualiza y pasa a agrupado', () => {
    const antes = registrarHueco(hueco, null, T0) as HuecoExistente
    const otra = normalizarHueco('para el pecho, cuantas SERIES por semana')
    expect(otra.temaClave).toBe(hueco.temaClave)
    const f = registrarHueco(otra, antes, T1)
    expect(f).toMatchObject({ conteo: 2, frase_limpia: hueco.frase, primera_vez: T0.toISOString(), ultima_vez: T1.toISOString(), estado: 'agrupado' })
    const f3 = registrarHueco(otra, f as HuecoExistente, T1)
    expect(f3?.conteo).toBe(3)
  })

  it('un estado más avanzado no retrocede al repetirse el tema', () => {
    const antes: HuecoExistente = { tema_clave: hueco.temaClave, frase_limpia: hueco.frase, conteo: 5, primera_vez: T0.toISOString(), estado: 'en_investigacion' }
    expect(registrarHueco(hueco, antes, T1)).toMatchObject({ conteo: 6, estado: 'en_investigacion' })
  })

  it('una fila existente de OTRO tema no se mezcla: cuenta como tema nuevo', () => {
    const otro: HuecoExistente = { tema_clave: 'descanso sentadilla', frase_limpia: 'x', conteo: 9, primera_vez: T0.toISOString(), estado: 'nuevo' }
    expect(registrarHueco(hueco, otro, T1)).toMatchObject({ conteo: 1, tema_clave: hueco.temaClave })
  })

  it('sin clave o sin frase (todo tapado por el limpiador): no hay nada que encolar', () => {
    expect(registrarHueco({ temaClave: '', frase: '[…] […]' }, null, T0)).toBeNull()
    expect(registrarHueco({ temaClave: 'series', frase: '   ' }, null, T0)).toBeNull()
    expect(registrarHueco(normalizarHueco('[…] […]'), null, T0)).toBeNull()
  })

  it('la frase nunca pasa de 300 caracteres, aunque llegue más larga', () => {
    const f = registrarHueco({ temaClave: 'series', frase: 'series '.repeat(200) }, null, T0)
    expect(f?.frase_limpia.length).toBeLessThanOrEqual(300)
  })

  it('es pura: no cambia lo que recibe y da lo mismo dos veces', () => {
    const antes: HuecoExistente = { tema_clave: hueco.temaClave, frase_limpia: hueco.frase, conteo: 2, primera_vez: T0.toISOString(), estado: 'agrupado' }
    const copia = structuredClone(antes)
    expect(registrarHueco(hueco, antes, T1)).toEqual(registrarHueco(hueco, antes, T1))
    expect(antes).toEqual(copia)
  })
})

describe('la tabla de huecos no guarda nada que identifique', () => {
  const sql = readFileSync('supabase/migrations/0180_praxis_huecos.sql', 'utf8')
  const bloque = sql.match(/create table[\s\S]*?\n\);/i)?.[0] ?? ''
  const columnas = bloque
    .split('\n')
    .slice(1)
    .map((l) => l.trim().split(/\s+/)[0])
    .filter((c) => /^[a-z_]+$/.test(c) && c !== 'constraint' && c !== 'check')

  it('la fila que sale del upsert trae exactamente las columnas de la tabla (menos id) y ninguna de persona', () => {
    const f = registrarHueco(hueco, null, T0)!
    expect(Object.keys(f).sort()).toEqual(['conteo', 'estado', 'frase_limpia', 'primera_vez', 'tema_clave', 'ultima_vez'])
    expect([...columnas].sort()).toEqual(['conteo', 'estado', 'frase_limpia', 'id', 'primera_vez', 'tema_clave', 'ultima_vez'])
  })

  it('la migración no tiene ninguna columna de persona ni referencia a auth.users', () => {
    const cuerpo = sql
      .split('\n')
      .filter((l) => !l.trim().startsWith('--'))
      .join('\n')
    expect(cuerpo).not.toMatch(/user_id|usuario|persona_id|asesorado|correo|email|nombre|auth\.users|session|sesion|ip_/i)
  })

  it('la migración tiene el tope de 300, RLS, solo el equipo lee, solo service_role escribe y la cabecera que dice que ya está APLICADA', () => {
    expect(sql).toMatch(/APLICADA en la base real/)
    expect(sql).not.toMatch(/NO APLICADA/)
    expect(sql).toMatch(/length\(frase_limpia\) <= 300/)
    expect(sql).toMatch(/enable row level security/)
    expect(sql).toMatch(/using \(\(select public\.es_staff\(\)\)\)/)
    expect(sql).toMatch(/grant select on public\.praxis_huecos to authenticated/)
    expect(sql).toMatch(/grant all on public\.praxis_huecos to service_role/)
    expect(sql).not.toMatch(/grant (insert|update|delete|all)[^;]*to (authenticated|anon)/i)
    expect(sql).toMatch(/revoke all on public\.praxis_huecos from anon/)
  })

  it('los estados de la tabla son los del código', () => {
    for (const e of ESTADOS_HUECO) expect(sql).toContain(`'${e}'`)
  })
})
