import { useEffect, useRef, useState } from 'react'

/**
 * LA RESPUESTA CON SU ORIGEN. Dice de qué ficha salió, para que se note si contestó otra cosa, y deja avisarlo:
 * una ficha equivocada con seguridad no entra sola en la cola. Con varias fichas, Praxis está ofreciendo opciones
 * y la función ya dejó la frase en la cola, así que aquí no se ofrece nada más.
 */

export interface ServiciosDeFicha {
  tituloDe: (id: string) => Promise<string | null>
  noEraEsto: (p: { frase: string; ficha: string }) => Promise<boolean>
}

type Aviso = 'sin_tocar' | 'enviando' | 'anotado' | 'fallo'

const TEXTO_DEL_AVISO: Record<Exclude<Aviso, 'sin_tocar' | 'enviando'>, string> = {
  anotado: 'Listo, la dejé para revisar.',
  fallo: 'No pude anotarlo. Inténtalo más tarde.',
}

export function RespuestaDeFicha({ texto, fichas, frase, servicios }: { texto: string; fichas: readonly string[]; frase: string; servicios: ServiciosDeFicha }) {
  const unica = fichas.length === 1 ? fichas[0]! : null
  const [titulo, setTitulo] = useState<string | null>(null)
  const [aviso, setAviso] = useState<Aviso>('sin_tocar')
  const { tituloDe, noEraEsto } = servicios
  const raiz = useRef<HTMLDivElement>(null)
  // El título llega después y empuja el resto: sin esto, «No era esto» quedaba cortado contra el borde del panel.
  useEffect(() => {
    raiz.current?.scrollIntoView?.({ block: 'nearest' })
  }, [titulo, aviso])

  useEffect(() => {
    if (!unica) return
    let vivo = true
    void tituloDe(unica).then((t) => {
      if (vivo) setTitulo(t)
    }, () => undefined)
    return () => {
      vivo = false
    }
  }, [unica, tituloDe])

  const avisar = async () => {
    if (!unica) return
    setAviso('enviando')
    setAviso((await noEraEsto({ frase, ficha: unica }).catch(() => false)) ? 'anotado' : 'fallo')
  }

  return (
    <div ref={raiz} className="mt-3">
      {titulo && <p className="text-[11px] font-semibold text-tenue">De la ficha: {titulo}</p>}
      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-texto">{texto}</p>
      {unica && (aviso === 'sin_tocar' || aviso === 'enviando') && (
        <button type="button" disabled={aviso === 'enviando'} onClick={() => void avisar()} className="press min-h-[44px] text-xs font-semibold text-tenue disabled:opacity-40">
          No era esto
        </button>
      )}
      {(aviso === 'anotado' || aviso === 'fallo') && <p className="mt-2 text-xs text-tenue">{TEXTO_DEL_AVISO[aviso]}</p>}
    </div>
  )
}
