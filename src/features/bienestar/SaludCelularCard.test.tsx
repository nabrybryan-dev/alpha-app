import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SaludCelularCard } from './SaludCelularCard'
import * as salud from '../../data/salud/saludCelular'
import { ALCANCE_CASILLA_E, DECLARACION, TEXTO_CASILLA_E } from '../../domain/interesados/formulario'

/**
 * La tarjeta «Salud de tu celular» (Fase A). Se mockea `data/salud/saludCelular` —como
 * `TarjetaVidaCard.test.tsx` con su capa de datos—: al componente no le importa cómo se
 * guarda, sino que pida el permiso con la casilla SIN marcar, enseñe el código una sola vez y
 * deje revocar.
 */

vi.mock('../../data/salud/saludCelular', async () => {
  const real = await vi.importActual<typeof salud>('../../data/salud/saludCelular')
  return {
    ...real,
    leerEstadoSalud: vi.fn(),
    otorgarPermisoE: vi.fn(),
    revocarPermisoE: vi.fn(),
    generarCodigoAtajo: vi.fn(),
    revocarCodigoAtajo: vi.fn(),
  }
})

const SIN_PERMISO: salud.EstadoSalud = {
  permiso: false,
  permisoDesde: null,
  codigoActivo: false,
  codigoCreadoEn: null,
  codigoUltimoUsoEn: null,
  ultimaMuestra: null,
}
const CON_PERMISO: salud.EstadoSalud = { ...SIN_PERMISO, permiso: true, permisoDesde: '2026-09-28T15:00:00Z' }
const CON_CODIGO: salud.EstadoSalud = { ...CON_PERMISO, codigoActivo: true, codigoCreadoEn: '2026-09-28T15:05:00Z' }
const CODIGO = 'sa_' + 'ab12cd34ef'.repeat(4)
const ENLACE = 'https://www.icloud.com/shortcuts/0123456789abcdef0123456789abcdef'

beforeEach(() => {
  vi.mocked(salud.leerEstadoSalud).mockReset()
  vi.mocked(salud.otorgarPermisoE).mockReset()
  vi.mocked(salud.revocarPermisoE).mockReset()
  vi.mocked(salud.generarCodigoAtajo).mockReset()
  vi.mocked(salud.revocarCodigoAtajo).mockReset()
})

describe('cuando no hay nada que enseñar', () => {
  it('no pinta nada mientras la base no responde, ni si no hay nube o la migración no está', async () => {
    vi.mocked(salud.leerEstadoSalud).mockResolvedValue(null)
    const { container } = render(<SaludCelularCard plataforma="ios" />)
    await waitFor(() => expect(salud.leerEstadoSalud).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('en Android explica el registro a mano y no ofrece ni permiso ni código', async () => {
    render(<SaludCelularCard plataforma="android" />)
    expect(screen.getByText(/solo funciona en iPhone/i)).toBeInTheDocument()
    expect(screen.getByText(/anota tus pasos, tu sueño y tu peso a mano en el check-in/i)).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
    expect(salud.leerEstadoSalud).not.toHaveBeenCalled()
  })
})

describe('sin permiso: la casilla E', () => {
  beforeEach(() => vi.mocked(salud.leerEstadoSalud).mockResolvedValue(SIN_PERMISO))

  it('enseña el texto de la casilla, los seis datos y su alcance, con todo SIN marcar', async () => {
    render(<SaludCelularCard plataforma="ios" />)
    expect(await screen.findByText(TEXTO_CASILLA_E)).toBeInTheDocument()

    const seis = within(screen.getByRole('list', { name: 'Los seis datos' })).getAllByRole('listitem')
    expect(seis.map((li) => li.textContent)).toEqual([
      'pasos',
      'sueño',
      'frecuencia cardiaca en reposo',
      'variabilidad de la frecuencia cardiaca',
      'minutos de ejercicio',
      'peso',
    ])
    expect(screen.getByText(ALCANCE_CASILLA_E)).toBeInTheDocument()
    expect(screen.getByText(DECLARACION)).toBeInTheDocument()

    for (const nombre of ['Casilla E', 'Declaración']) {
      for (const b of within(screen.getByRole('group', { name: nombre })).getAllByRole('button')) {
        expect(b).toHaveAttribute('aria-pressed', 'false')
      }
    }
    expect(screen.getByRole('button', { name: 'Autorizar' })).toBeDisabled()
  })

  it('no ofrece generar el código sin el permiso', async () => {
    render(<SaludCelularCard plataforma="ios" enlaceDelAtajo={ENLACE} />)
    await screen.findByText(TEXTO_CASILLA_E)
    expect(screen.queryByRole('button', { name: /generar/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /abrir el atajo/i })).toBeNull()
  })

  it('solo autoriza con la casilla Y la declaración marcadas, y pide el permiso una vez', async () => {
    vi.mocked(salud.otorgarPermisoE).mockResolvedValue({ ok: true })
    render(<SaludCelularCard plataforma="ios" />)
    await screen.findByText(TEXTO_CASILLA_E)
    const autorizar = screen.getByRole('button', { name: 'Autorizar' })

    await userEvent.click(screen.getByRole('button', { name: 'Sí, lo autorizo' }))
    expect(autorizar).toBeDisabled() // falta la declaración
    await userEvent.click(screen.getByRole('button', { name: 'Acepto la declaración' }))
    expect(autorizar).toBeEnabled()

    vi.mocked(salud.leerEstadoSalud).mockResolvedValue(CON_PERMISO)
    await userEvent.click(autorizar)
    await waitFor(() => expect(salud.otorgarPermisoE).toHaveBeenCalledTimes(1))
    // Al volver a leer, ya hay permiso: aparece el botón del código.
    expect(await screen.findByRole('button', { name: 'Generar mi código' })).toBeInTheDocument()
  })

  it('marcar solo la declaración tampoco basta', async () => {
    render(<SaludCelularCard plataforma="ios" />)
    await screen.findByText(TEXTO_CASILLA_E)
    await userEvent.click(screen.getByRole('button', { name: 'Acepto la declaración' }))
    expect(screen.getByRole('button', { name: 'Autorizar' })).toBeDisabled()
    expect(salud.otorgarPermisoE).not.toHaveBeenCalled()
  })

  it('si la base falla, lo dice y no da el permiso por otorgado', async () => {
    vi.mocked(salud.otorgarPermisoE).mockResolvedValue({ ok: false, motivo: 'error' })
    render(<SaludCelularCard plataforma="ios" />)
    await screen.findByText(TEXTO_CASILLA_E)
    await userEvent.click(screen.getByRole('button', { name: 'Sí, lo autorizo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Acepto la declaración' }))
    await userEvent.click(screen.getByRole('button', { name: 'Autorizar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo/i)
    expect(screen.queryByRole('button', { name: 'Generar mi código' })).toBeNull()
  })

  it('dice la versión del texto y el canal', async () => {
    render(<SaludCelularCard plataforma="ios" />)
    expect(await screen.findByText(/Versión del texto: 0\.4 .*Canal: app/)).toBeInTheDocument()
  })
})

describe('con permiso: el código del atajo', () => {
  it('genera el código, lo enseña UNA vez y no lo deja en el teléfono', async () => {
    vi.mocked(salud.leerEstadoSalud).mockResolvedValue(CON_PERMISO)
    vi.mocked(salud.generarCodigoAtajo).mockResolvedValue({ ok: true, codigo: CODIGO })
    render(<SaludCelularCard plataforma="ios" />)

    vi.mocked(salud.leerEstadoSalud).mockResolvedValue(CON_CODIGO)
    await userEvent.click(await screen.findByRole('button', { name: 'Generar mi código' }))
    expect(await screen.findByLabelText('Tu código')).toHaveTextContent(CODIGO)
    expect(screen.getByText(/solo se muestra esta vez/i)).toBeInTheDocument()

    // Nada de almacenamiento del navegador.
    expect(JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage })).not.toContain('ab12cd34ef')

    // «Ya lo guardé» lo suelta: no vuelve a aparecer, aunque el código siga activo.
    await userEvent.click(screen.getByRole('button', { name: 'Ya lo guardé' }))
    expect(screen.queryByLabelText('Tu código')).toBeNull()
    expect(screen.queryByText(CODIGO)).toBeNull()
    expect(screen.getByText(/tiene un código activo/i)).toBeInTheDocument()
  })

  it('copia el código al portapapeles', async () => {
    vi.mocked(salud.leerEstadoSalud).mockResolvedValue(CON_PERMISO)
    vi.mocked(salud.generarCodigoAtajo).mockResolvedValue({ ok: true, codigo: CODIGO })
    const escribir = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: escribir }, configurable: true })
    render(<SaludCelularCard plataforma="ios" />)
    await userEvent.click(await screen.findByRole('button', { name: 'Generar mi código' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Copiar' }))
    expect(escribir).toHaveBeenCalledWith(CODIGO)
    expect(await screen.findByRole('button', { name: /copiado/i })).toBeInTheDocument()
  })

  it('si no se puede copiar, dice cómo hacerlo a mano y el código sigue a la vista', async () => {
    vi.mocked(salud.leerEstadoSalud).mockResolvedValue(CON_PERMISO)
    vi.mocked(salud.generarCodigoAtajo).mockResolvedValue({ ok: true, codigo: CODIGO })
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denegado')) },
      configurable: true,
    })
    render(<SaludCelularCard plataforma="ios" />)
    await userEvent.click(await screen.findByRole('button', { name: 'Generar mi código' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Copiar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/mantén el dedo/i)
    expect(screen.getByLabelText('Tu código')).toHaveTextContent(CODIGO)
  })

  it('si la relectura del estado falla después de generar, el código no desaparece', async () => {
    vi.mocked(salud.leerEstadoSalud).mockResolvedValueOnce(CON_PERMISO)
    vi.mocked(salud.generarCodigoAtajo).mockResolvedValue({ ok: true, codigo: CODIGO })
    render(<SaludCelularCard plataforma="ios" />)
    vi.mocked(salud.leerEstadoSalud).mockResolvedValue(null)
    await userEvent.click(await screen.findByRole('button', { name: 'Generar mi código' }))
    expect(await screen.findByLabelText('Tu código')).toHaveTextContent(CODIGO)
  })

  it('con un código activo dice cuándo llegó el último envío, y cambiarlo pide confirmar', async () => {
    vi.mocked(salud.leerEstadoSalud).mockResolvedValue({
      ...CON_CODIGO,
      codigoUltimoUsoEn: '2026-09-29T13:00:00Z',
      ultimaMuestra: '2026-09-28',
    })
    vi.mocked(salud.generarCodigoAtajo).mockResolvedValue({ ok: true, codigo: CODIGO })
    render(<SaludCelularCard plataforma="ios" />)
    expect(await screen.findByText(/Último envío:/)).toBeInTheDocument()
    expect(screen.getByText(/Último día con datos: 2026-09-28/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Generar otro código' }))
    expect(screen.getByText(/el código anterior dejará de funcionar/i)).toBeInTheDocument()
    expect(salud.generarCodigoAtajo).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'No' }))
    expect(screen.queryByText(/el código anterior dejará de funcionar/i)).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Generar otro código' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sí, generar otro' }))
    await waitFor(() => expect(salud.generarCodigoAtajo).toHaveBeenCalledTimes(1))
    expect(await screen.findByLabelText('Tu código')).toHaveTextContent(CODIGO)
  })

  it('sin ningún envío todavía, lo dice', async () => {
    vi.mocked(salud.leerEstadoSalud).mockResolvedValue(CON_CODIGO)
    render(<SaludCelularCard plataforma="ios" />)
    expect(await screen.findByText(/todavía no ha llegado ningún envío/i)).toBeInTheDocument()
  })

  it('quitar el código no toca el permiso', async () => {
    vi.mocked(salud.leerEstadoSalud).mockResolvedValue(CON_CODIGO)
    vi.mocked(salud.revocarCodigoAtajo).mockResolvedValue({ ok: true, habia: true })
    render(<SaludCelularCard plataforma="ios" />)
    vi.mocked(salud.leerEstadoSalud).mockResolvedValue(CON_PERMISO)
    await userEvent.click(await screen.findByRole('button', { name: 'Quitar el código' }))
    expect(await screen.findByRole('status')).toHaveTextContent(/ese código ya no funciona/i)
    expect(salud.revocarPermisoE).not.toHaveBeenCalled()
    expect(await screen.findByRole('button', { name: 'Generar mi código' })).toBeInTheDocument()
  })

  it('un error al generar se dice sin enseñar ningún código', async () => {
    vi.mocked(salud.leerEstadoSalud).mockResolvedValue(CON_PERMISO)
    vi.mocked(salud.generarCodigoAtajo).mockResolvedValue({ ok: false, motivo: 'sin_permiso' })
    render(<SaludCelularCard plataforma="ios" />)
    await userEvent.click(await screen.findByRole('button', { name: 'Generar mi código' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/autorizar la casilla E/i)
    expect(screen.queryByLabelText('Tu código')).toBeNull()
  })
})

describe('el enlace del atajo', () => {
  beforeEach(() => vi.mocked(salud.leerEstadoSalud).mockResolvedValue(CON_PERMISO))

  it('mientras no esté el enlace de iCloud, dice que todavía no está publicado y no pinta botón', async () => {
    render(<SaludCelularCard plataforma="ios" enlaceDelAtajo="" />)
    expect(await screen.findByText(/todavía no está publicado/i)).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('con el enlace de iCloud, abre el atajo en otra pestaña y sin pasar la referencia', async () => {
    render(<SaludCelularCard plataforma="ios" enlaceDelAtajo={ENLACE} />)
    const enlace = await screen.findByRole('link', { name: 'Abrir el atajo' })
    expect(enlace).toHaveAttribute('href', ENLACE)
    expect(enlace).toHaveAttribute('target', '_blank')
    expect(enlace.getAttribute('rel')).toContain('noopener')
    expect(enlace.getAttribute('rel')).toContain('noreferrer')
  })

  it('un enlace que no es de iCloud no se pinta como botón', async () => {
    render(<SaludCelularCard plataforma="ios" enlaceDelAtajo="https://malo.example/atajo" />)
    await screen.findByText(/todavía no está publicado/i)
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('cuenta los pasos para activarlo en el iPhone', async () => {
    render(<SaludCelularCard plataforma="ios" />)
    await screen.findByText(/cómo se activa en tu iPhone/i)
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Genera tu código y cópialo.',
      'Abre el atajo desde tu iPhone y toca «Obtener atajo».',
      'Cuando el atajo te pida el código, pégalo.',
      'Acepta el acceso a Salud y deja activada la automatización diaria.',
    ])
  })
})

describe('revocar', () => {
  it('por defecto borra también lo enviado, y lo dice al terminar', async () => {
    vi.mocked(salud.leerEstadoSalud).mockResolvedValue(CON_CODIGO)
    vi.mocked(salud.revocarPermisoE).mockResolvedValue({ ok: true, codigosRevocados: 1, muestrasBorradas: 12 })
    render(<SaludCelularCard plataforma="ios" />)
    await userEvent.click(await screen.findByRole('button', { name: 'Revocar mi permiso' }))
    expect(screen.getByRole('button', { name: 'Borrar también los datos que ya envié' })).toHaveAttribute('aria-pressed', 'true')

    vi.mocked(salud.leerEstadoSalud).mockResolvedValue(SIN_PERMISO)
    await userEvent.click(screen.getByRole('button', { name: 'Revocar' }))
    await waitFor(() => expect(salud.revocarPermisoE).toHaveBeenCalledWith(true))
    expect(await screen.findByRole('status')).toHaveTextContent(/revocaste tu permiso.*borramos 12 datos/i)
    // Vuelve a pedir la casilla, sin marcar.
    expect(await screen.findByText(TEXTO_CASILLA_E)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Autorizar' })).toBeDisabled()
  })

  it('si la persona desmarca el borrado, se revoca sin borrar', async () => {
    vi.mocked(salud.leerEstadoSalud).mockResolvedValue(CON_CODIGO)
    vi.mocked(salud.revocarPermisoE).mockResolvedValue({ ok: true, codigosRevocados: 1, muestrasBorradas: 0 })
    render(<SaludCelularCard plataforma="ios" />)
    await userEvent.click(await screen.findByRole('button', { name: 'Revocar mi permiso' }))
    await userEvent.click(screen.getByRole('button', { name: 'Borrar también los datos que ya envié' }))
    await userEvent.click(screen.getByRole('button', { name: 'Revocar' }))
    await waitFor(() => expect(salud.revocarPermisoE).toHaveBeenCalledWith(false))
    expect((await screen.findByRole('status')).textContent).not.toMatch(/borramos/)
  })

  it('cancelar no revoca nada', async () => {
    vi.mocked(salud.leerEstadoSalud).mockResolvedValue(CON_PERMISO)
    render(<SaludCelularCard plataforma="ios" />)
    await userEvent.click(await screen.findByRole('button', { name: 'Revocar mi permiso' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(salud.revocarPermisoE).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Revocar mi permiso' })).toBeInTheDocument()
  })

  it('si la base falla, el permiso sigue como estaba y se avisa', async () => {
    vi.mocked(salud.leerEstadoSalud).mockResolvedValue(CON_PERMISO)
    vi.mocked(salud.revocarPermisoE).mockResolvedValue({ ok: false, motivo: 'error' })
    render(<SaludCelularCard plataforma="ios" />)
    await userEvent.click(await screen.findByRole('button', { name: 'Revocar mi permiso' }))
    await userEvent.click(screen.getByRole('button', { name: 'Revocar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo/i)
    expect(screen.getByText('Permiso activo')).toBeInTheDocument()
  })
})
