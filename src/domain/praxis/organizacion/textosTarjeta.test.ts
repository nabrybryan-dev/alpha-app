import { describe, expect, it } from 'vitest'
import { AVISO, PREGUNTA, RECHAZO, RESULTADO, TEXTO, VENTANA_DESHACER_MS, botonDeshacerVarias, botonEsconderVarias } from './textosTarjeta'

/** Los textos aprobados por Bryan el 11-nov (DISENO-TARJETA-CONFIRMACION-ORGANIZAR-20261111.md, §1, §2 y §8). */
describe('textos de la tarjeta de organizar', () => {
  it('cálidos donde hay una razón que explicar (P2, P7, R1, R2, R4, R7)', () => {
    expect(TEXTO.ocultarEnVezDeBorrar('tu', 'Logros')).toBe('Puedo esconder «Logros», pero no borrarlo: tus datos quedan guardados. ¿Lo escondo?')
    expect(TEXTO.restablecer('tu')).toBe('¿Vuelvo tu pantalla a como viene de fábrica? Se borran tus cambios de orden, no tus datos.')
    expect(RECHAZO.fija('tu', 'Check-in')).toBe('«Check-in» no se esconde: es parte de tu cuidado. Sí lo puedo mover.')
    expect(RECHAZO.asignada('tu')).toBe('Eso lo pone tu coach, así que lo cambia él. ¿Le aviso?')
    expect(RECHAZO.tope('tu', 6)).toBe('Ya tienes 6 cosas escondidas, que es el máximo. ¿Traigo alguna para esconder esta?')
    expect(RECHAZO.contieneProtegidas('tu')).toBe('Esa pantalla lleva dentro cosas de tu coach o de tu cuidado, así que no la escondo entera.')
  })

  it('secos en los avisos de un solo dato (R3, R5, R6, R8, I1, I3b)', () => {
    expect(RECHAZO.nucleo).toBe('Hoy y Praxis no se mueven.')
    expect(RECHAZO.yaOculta).toBe('Ya está escondido. ¿Traerlo?')
    expect(RECHAZO.equipo).toBe('Eso es del equipo; no se organiza aquí.')
    expect(RECHAZO.sinAcceso('tu')).toBe('Pantalla no disponible para tu cuenta.')
    expect(AVISO.nadaQueDeshacer).toBe('No hay cambios que deshacer.')
    expect(AVISO.ocultasVacia).toBe('Nada escondido.')
  })

  it('confirmaciones en el tono cálido aprobado', () => {
    expect(TEXTO.ocultar('tu', 'Logros')).toBe('¿Escondo «Logros» de tu pantalla? Lo puedes volver a traer cuando quieras.')
    expect(TEXTO.avisoCoachPesoOMedidas('tu')).toBe('Tu coach verá que lo escondiste, sin ver lo que dijiste.')
    expect(TEXTO.subir('tu', 'Nutrición')).toBe('¿Subo «Nutrición» un lugar en tu pantalla?')
    expect(TEXTO.traerConfirmar('tu', 'Nutrición')).toBe('¿Te llevo a «Nutrición»?')
    expect(RESULTADO.aplicada.ocultar).toBe('Listo, lo escondí.')
    expect(RESULTADO.error).toBe('No pude hacerlo ahora y no cambié nada.')
  })

  it('«solo lo importante» dice el número real, sin redondear, y en singular cuando es una', () => {
    expect(TEXTO.soloLoImportante('tu', 7)).toBe('Esto esconde 7 cosas y deja solo lo esencial. ¿Seguimos?')
    expect(TEXTO.soloLoImportante('tu', 1)).toBe('Esto esconde 1 cosa y deja solo lo esencial. ¿Seguimos?')
    expect(botonEsconderVarias(7)).toBe('Sí, esconder 7')
    expect(botonDeshacerVarias(7)).toBe('Deshacer (7)')
    expect(botonDeshacerVarias(1)).toBe('Deshacer')
  })

  it('el «Deshacer» dura entre 10 y 15 segundos (decisión 2)', () => {
    expect(VENTANA_DESHACER_MS).toBeGreaterThanOrEqual(10_000)
    expect(VENTANA_DESHACER_MS).toBeLessThanOrEqual(15_000)
  })

  it('con «usted» ningún texto tutea', () => {
    const n = 'Logros'
    const deUsted = [
      TEXTO.ocultar('usted', n), TEXTO.avisoCoachPesoOMedidas('usted'), TEXTO.ocultarEnVezDeBorrar('usted', n), TEXTO.subir('usted', n), TEXTO.bajar('usted', n),
      TEXTO.deshacerUltimo('usted'), TEXTO.restablecer('usted'), TEXTO.traerConfirmar('usted', n), TEXTO.queja('usted', n),
      PREGUNTA.cualHayMas('usted'), PREGUNTA.dimeCual('usted'), AVISO.lista('usted', [n]), AVISO.ocultas('usted', [n]),
      RECHAZO.fija('usted', n), RECHAZO.asignada('usted'), RECHAZO.tope('usted', 6), RECHAZO.contieneProtegidas('usted'), RECHAZO.sinAcceso('usted'),
      RECHAZO.noExiste('usted', [n]), RESULTADO.choque('usted'),
    ]
    for (const t of deUsted) expect(t, t).not.toMatch(/\b(tu|tus|te|puedes|quieras|tienes|dime|escondiste|dijiste|mostrarte|pídemelo)\b/i)
  })

  it('las listas largas se cortan en 6 y no repiten nombres', () => {
    expect(AVISO.lista('tu', ['a', 'b', 'c', 'd', 'e', 'f', 'g'])).toBe('Esto puedes esconder: a, b, c, d, e, f…')
    expect(AVISO.ocultas('tu', ['x', 'x'])).toBe('Tienes escondido: x. ¿Traigo alguno?')
    expect(PREGUNTA.cual(['A', 'B', 'C'])).toBe('¿Cuál de estas: «A», «B» o «C»?')
  })
})
