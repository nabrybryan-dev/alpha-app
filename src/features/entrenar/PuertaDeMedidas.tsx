import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import { db, hoyIso, useDbVersion } from '../../data/dbInstance'
import { useSesion } from '../../app/SessionProvider'
import { evaluarRequisitoMedidas } from '../../domain/requisitosMedidas'

/**
 * Puerta al plan de entrenamiento: sin medidas corporales vigentes no se ve la
 * semana.
 *
 * Solo cubre **entrenar**. Bienestar —donde se cargan las medidas— y el resto de
 * la app quedan abiertos a propósito: una puerta que tapa la pantalla que la
 * abre es un candado sin llave.
 *
 * Al staff no se le aplica: el coach y la nutricionista entran a ver a otros.
 */
export function PuertaDeMedidas({ children }: { children: ReactNode }) {
  useDbVersion()
  const { usuario } = useSesion()

  if (usuario.rol !== 'asesorado') return <>{children}</>

  const perfil = db.perfiles.byUsuario(usuario.id)
  const requisito = evaluarRequisitoMedidas(perfil, hoyIso(), perfil?.medidasRequeridas ?? [])

  if (requisito.cumple) return <>{children}</>

  const soloVencida = requisito.faltan.length === 0 && requisito.vencida

  return (
    <div className="space-y-4 p-4" data-testid="puerta-medidas">
      <Card destacada>
        <h1 className="text-lg font-bold">
          {soloVencida ? 'Tus medidas están vencidas' : 'Antes de entrenar, faltan tus medidas'}
        </h1>

        <p className="mt-3 text-sm text-tenue">
          {soloVencida ? (
            <>
              La última vez que te mediste fue hace{' '}
              <strong className="cifras">{requisito.diasDesdeUltima}</strong> días. Con ese
              dato ya no se puede saber si tu plan está funcionando.
            </>
          ) : (
            <>
              Tu programación se decide con lo que tu cuerpo dice, no con lo que suponemos.
              Sin estos datos no podemos saber si el bloque está funcionando ni ajustarte la
              semana que viene.
            </>
          )}
        </p>

        {requisito.faltan.length > 0 && (
          <>
            <p className="mt-4 text-sm font-semibold">Falta cargar:</p>
            <ul className="mt-2 space-y-1">
              {requisito.faltan.map(dato => (
                <li key={dato} className="text-sm">
                  · {dato}
                </li>
              ))}
            </ul>
          </>
        )}

        <Link
          to="/bienestar"
          className="mt-5 block rounded-panel bg-accion px-4 py-3 text-center text-sm font-bold text-fondo"
        >
          Cargar mis medidas
        </Link>

        <p className="mt-4 text-xs text-tenue">
          Se cargan una vez y toman dos minutos. En cuanto estén, tu semana se desbloquea
          sola.
        </p>
      </Card>

      <Card>
        <p className="text-xs text-tenue">
          ¿No tienes cómo medirte ahora mismo? Escríbele a tu coach por el chat y lo
          resolvemos. Lo que no queremos es seguir programándote a ciegas.
        </p>
      </Card>
    </div>
  )
}
