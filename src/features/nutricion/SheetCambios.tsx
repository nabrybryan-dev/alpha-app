import { Sheet } from '../../components/ui/Sheet'
import { useSesion } from '../../app/SessionProvider'
import { db, useDbVersion } from '../../data/dbInstance'
import { catalogoRepo } from '../../data/catalogo/catalogoRepo'
import {
  cambiosPara,
  porQueNoHayCambios,
  porcionDeReferencia,
  type Cambio,
  type MacroDeLaDeriva,
} from '../../domain/nutricion/bioequivalentes'
import { leerPauta } from '../../domain/nutricion/pauta'

/**
 * «No tengo esto. ¿Por qué lo cambio?»
 *
 * VIVE EN EL PLAN Y NO EN EL BUSCADOR, y esa es la decisión de diseño. El
 * momento de necesidad es cuando va a cocinar y no tiene lo que le pautaron —el
 * número dos de abandono, después del hambre—. En el buscador llegaría tarde:
 * ahí ya está anotando lo que se comió.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LO QUE ESTA HOJA NO PROMETE, Y LO QUE SÍ
 * ─────────────────────────────────────────────────────────────────────────────
 * SÍ: lo que la nutricionista marcó que esta persona no debe comer no se le
 * propone. La app no interpreta el texto libre de las alergias —«soy alérgica a
 * los mariscos» no se convierte solo en una lista de ids, y equivocarse ahí es
 * proponerle a alguien lo que le hace daño—: quien traduce es Manuela, desde su
 * panel, y aquí se lee lo que ella escribió (`db.vetados`).
 *
 * NO: no dice «esto lo puedes comer». Dice «esto ocupa el mismo lugar en tu
 * plan». Un veto que Manuela todavía no escribió no existe para la app, así que
 * lo otro que sostiene la propuesta es de dónde sale: **todas son del mismo
 * grupo que algo que ella ya le puso en el plan**. No es una promesa clínica y
 * no se escribe como si lo fuera.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA DERIVA SE ENSEÑA
 * ─────────────────────────────────────────────────────────────────────────────
 * Igualar el macro ancla no iguala el plato. Enseñar solo «380 g de pasta»
 * sería vender un cambio gratis; lo que va al lado es lo que mueve de verdad.
 */

const NOMBRE_DEL_MACRO: Record<MacroDeLaDeriva, string> = {
  kcal: 'kcal',
  proteina_g: 'proteína',
  carbos_g: 'carbos',
  grasa_g: 'grasa',
}

/** Debajo de esto la diferencia es ruido de redondeo y no se pinta. */
const MINIMO_QUE_SE_DICE: Record<MacroDeLaDeriva, number> = {
  kcal: 5,
  proteina_g: 0.5,
  carbos_g: 0.5,
  grasa_g: 0.5,
}

interface SheetCambiosProps {
  /** La línea del plan, tal cual está escrita. `null` cierra la hoja. */
  linea: string | null
  onCerrar: () => void
}

export function SheetCambios({ linea, onCerrar }: SheetCambiosProps) {
  const { usuario } = useSesion()
  useDbVersion()

  const [pauta] = linea ? leerPauta(linea) : []
  // La misma búsqueda que siembra el diario cuando se registra desde el plan:
  // si las dos resolvieran distinto, la asesorada vería una cosa y anotaría otra.
  const [alimento] = pauta ? catalogoRepo.buscar(pauta.busqueda, undefined, 1) : []

  // Lo que Manuela marcó que no puede comer. Se lee aquí y no en el dominio:
  // `cambiosPara` no debe saber de dónde salen los vetos, solo recibirlos, así
  // que el día que vengan de otro sitio no hay que tocarlo.
  const vetados = new Set(db.vetados.byUsuario(usuario.id).map((v) => v.alimentoId))
  const cambios = alimento ? cambiosPara(alimento, catalogoRepo.porId, vetados) : []
  const porcion = alimento ? porcionDeReferencia(alimento.id) : null

  return (
    <Sheet abierto={linea !== null} titulo="¿Por qué lo cambio?" onCerrar={onCerrar}>
      {!alimento ? (
        <p className="text-sm leading-snug text-tenue">
          No encontramos <b className="text-texto">{linea}</b> en el catálogo, así que no podemos
          proponerte un cambio. Coméntaselo a tu nutricionista.
        </p>
      ) : cambios.length === 0 ? (
        <SinCambios alimento={alimento.nombre} motivo={porQueNoHayCambios(alimento).motivo} />
      ) : (
        <>
          <p className="text-[11px] leading-snug text-tenue">
            En vez de{' '}
            <b className="text-texto">
              {porcion} g de {alimento.nombre}
            </b>
            , cualquiera de estos ocupa su mismo lugar en el plan. Lo que cambia va al lado.
          </p>

          <ul className="mt-3 flex flex-col gap-2">
            {cambios.map((cambio) => (
              <FilaCambio key={cambio.alimento.id} cambio={cambio} />
            ))}
          </ul>

          {/* No es un descargo legal: es lo que de verdad sostiene la lista.
              Salen del mismo grupo que lo que ella ya tiene pautado. */}
          <p className="mt-4 text-[10px] leading-snug text-tenue">
            Son alimentos del mismo grupo que el que te pautaron. Si alguno no te cae bien o no
            puedes comerlo, díselo a tu nutricionista.
          </p>
        </>
      )}
    </Sheet>
  )
}

function FilaCambio({ cambio }: { cambio: Cambio }) {
  const movimientos = (Object.keys(cambio.deriva) as MacroDeLaDeriva[])
    .filter((macro) => Math.abs(cambio.deriva[macro] ?? 0) >= MINIMO_QUE_SE_DICE[macro])
    .map((macro) => {
      const valor = cambio.deriva[macro] ?? 0
      const redondeado = macro === 'kcal' ? Math.round(valor) : Math.round(valor * 10) / 10
      return `${redondeado > 0 ? '+' : ''}${redondeado} ${NOMBRE_DEL_MACRO[macro]}`
    })

  return (
    <li className="rounded-2xl border border-linea bg-surface-2 p-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 flex-1 text-sm leading-snug text-texto">
          {cambio.alimento.nombre}
        </span>
        <b className="cifras shrink-0 text-sm text-texto">{cambio.gramos} g</b>
      </div>
      <p className="cifras mt-1 text-[11px] text-tenue">
        {/* Sin movimientos que valga la pena decir, se dice eso y no un vacío:
            «casi no cambia nada» es información, un renglón en blanco no. */}
        {movimientos.length > 0 ? movimientos.join(' · ') : 'casi no cambia nada'}
      </p>
    </li>
  )
}

function SinCambios({ alimento, motivo }: { alimento: string; motivo: string }) {
  // VACÍO NO ES «NO HAY NADA PARECIDO», y a ella le cambia lo que puede hacer.
  const texto =
    motivo === 'sin_ancla'
      ? `${alimento} no se cambia por un solo nutriente —los azúcares, las salsas y las bebidas no forman un grupo con una regla común—, así que este cambio lo decide tu nutricionista.`
      : `Todavía no tenemos medida la porción de ${alimento}, y sin saber cuánto se come no se puede decir por cuánto cambiarlo. Coméntaselo a tu nutricionista.`

  return <p className="text-sm leading-snug text-tenue">{texto}</p>
}
