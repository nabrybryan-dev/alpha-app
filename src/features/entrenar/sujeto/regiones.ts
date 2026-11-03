/**
 * LAS 15 REGIONES DE LA MAQUETA Y A CUÁL PERTENECE CADA MÚSCULO DEL SUJETO DE BLENDER.
 *
 * El sujeto aprobado (piezas `atlas-musculos-alpha*`, 522 partes) trae un músculo por
 * parte, con su nombre de Z-Anatomy. La maqueta 7 no pinta 522 cosas: pinta quince
 * REGIONES, que son las que el asesorado entiende («Dorsal 2 · Bíceps 1») y las que salen
 * de las series anotadas (`domain/taxonomia`). Esta tabla es el puente.
 *
 * ## Reglas que no se rompen
 *
 * - **Ninguno se pierde en silencio.** Cada músculo de las piezas está en una región o en
 *   `MUSCULOS_SIN_REGION`, con su motivo. `regiones.test.ts` lo comprueba contra las dos
 *   piezas de verdad (escritorio y celular).
 * - **No se quitan los profundos.** Un músculo sin región sigue dibujándose (Bryan,
 *   23-oct): solo se queda sin tinte, en el color de base.
 * - **Los dos lados juntos.** Se busca por el nombre sin `.l` / `.r`.
 * - **Un criterio por región, no por músculo suelto** (anatomía de superficie, como lo
 *   lee quien entrena): espalda alta y media → `dors`; cintura escapular y manguito → `delt`;
 *   rectos y transverso → `abd`; oblicuos y serrato anterior → `obl`; glúteos, rotadores
 *   cortos de la cadera y TFL → `glu`; pierna (gemelos, sóleo, tibiales, peroneos y flexores
 *   y extensores largos) → `gem`. El antebrazo incluye los intrínsecos que nacen en él.
 */

export type IdDeRegion =
  | 'pecho' | 'delt' | 'bic' | 'tri' | 'ante' | 'abd' | 'obl' | 'trap'
  | 'dors' | 'lumb' | 'glu' | 'cua' | 'isq' | 'adu' | 'gem'

/** Las quince, en el orden en que la maqueta las nombra. */
export const REGIONES: readonly { id: IdDeRegion; nombre: string }[] = [
  { id: 'pecho', nombre: 'Pectoral' },
  { id: 'delt', nombre: 'Deltoides' },
  { id: 'bic', nombre: 'Bíceps' },
  { id: 'tri', nombre: 'Tríceps' },
  { id: 'ante', nombre: 'Antebrazo' },
  { id: 'abd', nombre: 'Abdomen' },
  { id: 'obl', nombre: 'Oblicuos' },
  { id: 'trap', nombre: 'Trapecio' },
  { id: 'dors', nombre: 'Dorsal' },
  { id: 'lumb', nombre: 'Lumbares' },
  { id: 'glu', nombre: 'Glúteo' },
  { id: 'cua', nombre: 'Cuádriceps' },
  { id: 'isq', nombre: 'Isquiotibiales' },
  { id: 'adu', nombre: 'Aductores' },
  { id: 'gem', nombre: 'Gemelos' },
]

export const NOMBRE_DE_REGION: Record<IdDeRegion, string> = Object.fromEntries(
  REGIONES.map((r) => [r.id, r.nombre]),
) as Record<IdDeRegion, string>

/** Músculos por región, con el nombre de la pieza SIN el sufijo de lado. */
export const MUSCULOS_POR_REGION: Record<IdDeRegion, readonly string[]> = {
  pecho: [
    "(Abdominal part of pectoralis major muscle)",
    "Clavicular head of pectoralis major muscle",
    "Pectoralis minor muscle",
    "Sternocostal head of pectoralis major muscle",
    "Subclavius muscle",
  ],
  adu: [
    "(Adductor minimus)",
    "Adductor brevis",
    "Adductor longus",
    "Adductor magnus",
    "Gracilis muscle",
    "Pectineus muscle",
  ],
  ante: [
    "Abductor pollicis longus",
    "Brachioradialis muscle",
    "Common flexor tendon sheath",
    "Deep head of pronator teres",
    "Extensor carpi radialis brevis",
    "Extensor carpi radialis longus",
    "Extensor digiti minimi",
    "Extensor digitorum",
    "Extensor indicis",
    "Extensor pollicis brevis",
    "Extensor pollicis longus",
    "Flexor carpi radialis",
    "Flexor digitorum profundus",
    "Flexor pollicis longus",
    "Humeral head of extensor carpi ulnaris",
    "Humeral head of flexor carpi ulnaris",
    "Humero-ulnar head of flexor digitorum superficialis",
    "Palmar aponeurosis",
    "Palmaris longus muscle",
    "Pronator quadratus",
    "Radial head of flexor digitorum superficialis",
    "Superficial head of pronator teres",
    "Supinator",
    "Tendon sheath - abd. pollicis longus - ext. pollicis brevis",
    "Tendon sheath of extensor carpi ulnaris",
    "Tendon sheath of extensor digiti minimi manus",
    "Tendon sheath of extensor digitorum and extensor indicis",
    "Tendon sheath of extensor pollicis longus",
    "Tendon sheath of extensors carpi radialis",
    "Tendon sheath of flexor carpi radialis",
    "Tendon sheath of flexor pollicis longus",
    "Ulnar head of extensor carpi ulnaris",
    "Ulnar head of flexor carpi ulnaris",
  ],
  delt: [
    "Acromial part of deltoid muscle",
    "Clavicular part of deltoid muscle",
    "Infraspinatus muscle",
    "Intertubercular tendon sheath",
    "Scapular spinal part of deltoid muscle",
    "Subscapularis muscle",
    "Supraspinatus muscle",
    "Teres minor muscle",
  ],
  tri: [
    "Anconeus muscle",
    "Lateral head of triceps brachii",
    "Long head of triceps brachii",
    "Medial head of triceps brachii",
  ],
  trap: [
    "Ascending part of trapezius muscle",
    "Descending part of trapezius muscle",
    "Levator scapulae",
    "Rhomboid major muscle",
    "Rhomboid minor muscle",
    "Transverse part of trapezius muscle",
  ],
  bic: [
    "Brachialis muscle",
    "Coracobrachialis muscle",
    "Long head of biceps brachii",
    "Short head of biceps brachii",
  ],
  gem: [
    "Calcaneal tendon",
    "Common tendon sheath of fibularis muscles",
    "Extensor digitorum longus",
    "Extensor hallucis longus",
    "Fibularis brevis muscle",
    "Fibularis longus muscle",
    "Fibularis tertius muscle",
    "Flexor digitorum longus",
    "Flexor hallucis longus",
    "Lateral head of gastrocnemius",
    "Medial head of gastrocnemius",
    "Plantar tendon sheath of fibularis longus muscle",
    "Plantaris muscle",
    "Popliteus muscle",
    "Soleus muscle",
    "Tendon of extensor digitorum longus",
    "Tendon sheath of extensor digitorum longus",
    "Tendon sheath of extensor hallucis longus",
    "Tendon sheath of flexor digitorum longus",
    "Tendon sheath of flexor hallucis longus",
    "Tendon sheath of tibialis anterior",
    "Tendon sheath of tibialis posterior muscle",
    "Tibialis anterior muscle",
    "Tibialis posterior muscle",
  ],
  lumb: [
    "Dorsal parts of lateral intertransversarii lumborum muscles",
    "Iliocostalis lumborum muscle",
    "Interspinales lumborum muscles",
    "Multifidus lumborum muscle",
    "Quadratus lumborum muscle",
    "Ventral parts of lateral intertransversarii lumborum muscles",
  ],
  obl: [
    "External abdominal oblique muscle",
    "Internal abdominal oblique muscle",
    "Serratus anterior muscle",
  ],
  glu: [
    "Gluteus maximus muscle",
    "Gluteus medius muscle",
    "Gluteus minimus muscle",
    "Inferior gemellus muscle",
    "Obturator externus",
    "Obturator internus",
    "Piriformis muscle",
    "Quadratus femoris muscle",
    "Superior gemellus muscle",
    "Tensor fasciae latae",
  ],
  dors: [
    "Iliocostalis thoracis muscle",
    "Interspinales thoracis muscles",
    "Latissimus dorsi muscle",
    "Levatores breves costarum",
    "Levatores longi costarum",
    "Longissimus thoracis muscle",
    "Multifidus thoracis muscle",
    "Rotatores",
    "Semispinalis thoracis muscle",
    "Serratus posterior inferior muscle",
    "Serratus posterior superior muscle",
    "Spinalis thoracis muscle",
    "Teres major muscle",
  ],
  cua: [
    "Iliotibial tract",
    "Rectus femoris muscle",
    "Sartorius muscle",
    "Vastus intermedius muscle",
    "Vastus lateralis muscle",
    "Vastus medialis muscle",
  ],
  isq: [
    "Long head of biceps femoris",
    "Semimembranosus muscle",
    "Semitendinosus muscle",
    "Short head of biceps femoris",
  ],
  abd: [
    "Pyramidalis muscle",
    "Rectus abdominis muscle",
    "Transversus abdominis muscle",
  ],
}

/**
 * LO QUE NO TIENE REGIÓN EN LA MAQUETA, y por qué. Se dibuja igual (en el color de base):
 * la maqueta no tiene región de cuello, cara, mano, pie, suelo pélvico ni tórax profundo, y
 * inventarla para pintar un músculo que nadie entrena por series sería falsear el mapa.
 */
export const MUSCULOS_SIN_REGION: Record<string, readonly string[]> = {
  "pie": [
    "(Opponens digiti minimi muscle of foot)",
    "Abductor digiti minimi of foot",
    "Abductor hallucis",
    "Dorsal interossei muscles of foot",
    "Extensor digitorum brevis",
    "Extensor hallucis brevis",
    "Flexor digiti minimi of foot",
    "Flexor digitorum brevis",
    "Lateral head of flexor hallucis brevis",
    "Lumbrical muscles of foot",
    "Medial head of flexor hallucis brevis",
    "Oblique head of adductor hallucis",
    "Plantar aponeurosis",
    "Plantar interossei muscles",
    "Quadratus plantae muscle",
    "Transverse head of adductor hallucis",
  ],
  "mano": [
    "Abductor digiti minimi of hand",
    "Abductor pollicis brevis",
    "Deep head of flexor pollicis brevis",
    "Dorsal interossei muscles of hand",
    "Flexor digiti minimi of hand",
    "Lumbrical muscles of hand",
    "Oblique head of adductor pollicis",
    "Opponens digiti minimi muscle of hand",
    "Opponens pollicis muscle",
    "Palmar interossei muscles",
    "Superficial head of flexor pollicis brevis",
    "Transverse head of adductor pollicis",
  ],
  "suelo pélvico": [
    "Coccygeus muscle",
    "External anal sphincter",
    "Iliococcygeus muscle",
    "Pubo-analis muscle",
    "Pubococcygeus muscle",
    "Tendinous arch of levator ani",
  ],
  "tórax profundo": [
    "Diaphragm",
    "External intercostal muscles",
    "Innermost intercostal muscles",
    "Internal intercostal muscles",
    "Transversus thoracis muscle",
  ],
  "cadera profunda": [
    "Iliacus muscle",
    "Psoas major",
  ],
  "cabeza y cuello": [
    "Anterior belly of digastric muscle",
    "Ary-epiglottic part of oblique arytenoid muscle",
    "Bucinator",
    "Common tendinous ring",
    "Corrugator supercilii",
    "Deep part of masseter",
    "Depressor anguli oris",
    "Depressor labii inferioris",
    "Depressor septi nasi",
    "Epicranial aponeurosis",
    "External part of thyro-arytenoid muscle",
    "Frontalis muscle",
    "Genioglossus muscle",
    "Geniohyoid muscle",
    "Hyoglossus muscle",
    "Iliocostalis colli muscle",
    "Inferior head of lateral pterygoid muscle",
    "Inferior oblique muscle",
    "Inferior pharyngeal constrictor",
    "Inferior rectus muscle",
    "Inferior tarsus",
    "Intermediate tendon of digastric muscle",
    "Interspinales colli muscles",
    "Lateral crico-arytenoid muscle",
    "Lateral rectus muscle",
    "Levator anguli oris",
    "Levator labii superioris",
    "Levator nasolabialis",
    "Levator palpebrae superioris",
    "Longissimus capitis muscle",
    "Longissimus colli muscle",
    "Longus capitis muscle",
    "Longus colli muscle",
    "Medial pterygoid muscle",
    "Medial rectus muscle",
    "Mentalis muscle",
    "Middle pharyngeal constrictor",
    "Multifidus colli muscle",
    "Mylohyoid muscle",
    "Nasalis muscle",
    "Oblique part of cricothyroid muscle",
    "Obliquus inferior capitis muscle",
    "Obliquus superior capitis muscle",
    "Occipitalis muscle",
    "Omohyoid muscle",
    "Orbicularis oris muscle",
    "Orbital part of orbicularis oculi",
    "Palatopharyngeus muscle",
    "Palpebral part of orbicularis oculi",
    "Platysma",
    "Posterior belly of digastric muscle",
    "Posterior crico-arytenoid muscle",
    "Procerus muscle",
    "Rectus anterior capitis muscle",
    "Rectus lateralis capitis muscle",
    "Rectus posterior major capitis muscle",
    "Rectus posterior minor capitis muscle",
    "Risorius muscle",
    "Scalenus anterior muscle",
    "Scalenus medius muscle",
    "Scalenus posterior muscle",
    "Semispinalis colli muscle",
    "Spinalis capitis muscle",
    "Spinalis colli muscle",
    "Splenius capitis muscle",
    "Splenius colli muscle",
    "Sternocleidomastoid muscle",
    "Sternohyoid muscle",
    "Sternothyroid muscle",
    "Straight part of cricothyroid muscle",
    "Stylohyoid muscle",
    "Stylopharyngeus muscle",
    "Superficial part of masseter",
    "Superior head of lateral pterygoid muscle",
    "Superior oblique muscle",
    "Superior pharyngeal constrictor",
    "Superior rectus muscle",
    "Superior tarsus",
    "Temporalis muscle",
    "Temporoparietalis muscle",
    "Thyro-epiglottic part of thyro-arytenoid muscle",
    "Thyrohyoid muscle",
    "Transverse arytenoid muscle",
    "Trochlea of superior oblique muscle",
    "Zygomaticus major muscle",
    "Zygomaticus minor muscle",
  ],
}

const REGION_POR_CLAVE: ReadonlyMap<string, IdDeRegion | 'sin-region'> = (() => {
  const m = new Map<string, IdDeRegion | 'sin-region'>()
  for (const [region, lista] of Object.entries(MUSCULOS_POR_REGION)) {
    for (const n of lista) m.set(n, region as IdDeRegion)
  }
  for (const lista of Object.values(MUSCULOS_SIN_REGION)) {
    for (const n of lista) m.set(n, 'sin-region')
  }
  return m
})()

/** El nombre de la pieza sin el sufijo de lado: «Biceps brachii.l» -> «Biceps brachii». */
export function claveDeMusculo(nombreDePieza: string): string {
  return nombreDePieza.replace(/\.(l|r)$/, '')
}

/**
 * La región de un músculo del sujeto. `'sin-region'` si está anotado como tal;
 * `undefined` si la tabla no lo conoce (y entonces `regiones.test.ts` se pone en rojo).
 */
export function regionDeMusculo(nombreDePieza: string): IdDeRegion | 'sin-region' | undefined {
  return REGION_POR_CLAVE.get(claveDeMusculo(nombreDePieza))
}
