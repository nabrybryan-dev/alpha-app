import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { avisoPagoVisible, fechaEnEspanol } from './avisoPago'

const base = { venceDesde: '2026-10-05', enlace: 'https://pago.ejemplo.com/abc', activo: true }

// Zona de Colombia (UTC-5): ahí `new Date('2026-10-05')` cae el 4 y delata el desfase. En UTC
// ese error es invisible, así que la fecha se prueba con la zona fijada aquí y no con la del equipo.
const TZ_ORIGINAL = process.env.TZ
beforeAll(() => {
  process.env.TZ = 'America/Bogota'
})
afterAll(() => {
  if (TZ_ORIGINAL === undefined) delete process.env.TZ
  else process.env.TZ = TZ_ORIGINAL
})

describe('fechaEnEspanol', () => {
  it('dice el día y el mes sin ceros ni desfase de zona horaria', () => {
    expect(fechaEnEspanol('2026-10-05')).toBe('5 de octubre')
    expect(fechaEnEspanol('2026-01-31')).toBe('31 de enero')
  })
  it('una fecha que no existe no se inventa', () => {
    expect(fechaEnEspanol('2026-13-40')).toBeUndefined()
    expect(fechaEnEspanol('2026-02-30')).toBeUndefined()
    expect(fechaEnEspanol('ayer')).toBeUndefined()
    expect(fechaEnEspanol(undefined)).toBeUndefined()
  })
})

describe('avisoPagoVisible', () => {
  it('se muestra con activo y enlace https', () => {
    expect(avisoPagoVisible(base, 'Ana')?.enlace).toBe('https://pago.ejemplo.com/abc')
  })
  it.each([
    ['activo false', { ...base, activo: false }],
    ['activo ausente', { venceDesde: base.venceDesde, enlace: base.enlace }],
    ['activo como texto', { ...base, activo: 'true' }],
    ['sin enlace', { ...base, enlace: undefined }],
    ['enlace vacío', { ...base, enlace: '  ' }],
    ['enlace javascript:', { ...base, enlace: 'javascript:alert(1)' }],
    ['enlace http', { ...base, enlace: 'http://pago.ejemplo.com' }],
    ['enlace sin protocolo', { ...base, enlace: 'pago.ejemplo.com/abc' }],
    ['enlace con usuario y clave', { ...base, enlace: 'https://a:b@pago.ejemplo.com' }],
    ['enlace que no es texto', { ...base, enlace: 42 }],
  ])('NO se muestra con %s', (_nombre, datos) => {
    expect(avisoPagoVisible(datos, 'Ana')).toBeUndefined()
  })
  it('NO se muestra si no hay nada o no es un objeto', () => {
    expect(avisoPagoVisible(undefined, 'Ana')).toBeUndefined()
    expect(avisoPagoVisible(null, 'Ana')).toBeUndefined()
    expect(avisoPagoVisible('https://x.com', 'Ana')).toBeUndefined()
  })
  it('sin texto usa el aprobado, con nombre y fecha que salen de los datos', () => {
    expect(avisoPagoVisible(base, 'Ana')?.texto).toBe(
      'Ana, tu mensualidad de Alpha venció el 5 de octubre. Ya te cargué la semana para que no pierdas el ritmo que traes. Para seguir con tu plan, ponte al día aquí:',
    )
  })
  it('otra fecha y otro nombre cambian el texto', () => {
    const t = avisoPagoVisible({ ...base, venceDesde: '2026-11-12' }, 'Luis')?.texto
    expect(t).toMatch(/^Luis, tu mensualidad de Alpha venció el 12 de noviembre\./)
  })
  it('sin venceDesde válida y sin texto propio NO se muestra: no hay texto aprobado para ese caso', () => {
    expect(avisoPagoVisible({ ...base, venceDesde: undefined }, 'Ana')).toBeUndefined()
    expect(avisoPagoVisible({ ...base, venceDesde: '2026-02-30' }, 'Ana')).toBeUndefined()
    expect(avisoPagoVisible({ ...base, venceDesde: 'ayer' }, 'Ana')).toBeUndefined()
  })
  it('con texto propio no hace falta la fecha', () => {
    expect(avisoPagoVisible({ ...base, venceDesde: undefined, texto: 'Hola.' }, 'Ana')?.texto).toBe('Hola.')
  })
  it('sin nombre el texto no empieza por coma', () => {
    for (const nombre of ['', '   ']) {
      expect(avisoPagoVisible(base, nombre)?.texto).toMatch(/^Tu mensualidad de Alpha venció el 5 de octubre\. Ya te cargué/)
    }
  })
  it('si trae texto, se usa tal cual', () => {
    expect(avisoPagoVisible({ ...base, texto: 'Hola, mira esto.' }, 'Ana')?.texto).toBe('Hola, mira esto.')
  })
  it('un texto vacío cae al por defecto', () => {
    expect(avisoPagoVisible({ ...base, texto: '  ' }, 'Ana')?.texto).toMatch(/^Ana, tu mensualidad/)
  })
})
