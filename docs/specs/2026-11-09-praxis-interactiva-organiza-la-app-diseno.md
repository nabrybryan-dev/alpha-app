# Praxis interactiva: la app se organiza hablando (diseño, sin código)

Fecha: 9-nov-2026. Estado: PROPUESTA para aprobar por muestra con Bryan. No se escribió código, migración ni bandera. Marcas: [V] lo leí hoy en main (e1c0d402) con ruta; [M] viene de un traspaso o de memoria y no lo re-comprobé; [P] propuesta mía, sin firma.

## 0. Objetivo central y orden de Bryan (9-nov)

Objetivo central de Praxis: una sola Praxis en la app que responda, lleve a pantallas, registre y enseñe a discernir, movida por nuestro modelo.

Orden de Bryan para esta pieza: la app no debe mostrar subdivisiones estáticas. Se adapta a cada asesorado y a sus necesidades; Praxis puede cambiar esa organización para que cada asesorado ordene la suya; y todos los menús, áreas, cuadros y demás partes se pueden traer o desplegar hablando con Praxis («muéstrame...», «ábreme...», «ponme arriba...»).

Respaldo ya decidido: barra que se adapta por etapa (`DECISIONES-ENRUTADOR-20261104.md` l.41 [V]) y «reorganizar ya y medir desde ahí: no se borra nada, se mueve u oculta» (`00-PLAN.md` l.46 [V]).

Símil: hoy la app es un edificio con letreros fijos; esto es un portero que, a pedido de cada inquilino, abre una puerta, cambia el orden de su piso y guarda la llave de vuelta, pero que nunca tapia la salida de emergencia.

## 1. Qué hay hoy (lo que se reutiliza)

| Pieza | Qué es | Evidencia |
|---|---|---|
| Barra inferior fija | 5 pestañas fijas del asesorado (Hoy, Entrenar, Semana, Nutrición...) | `src/components/ui/BottomNav.tsx` l.20-60 [V] |
| Barra por etapa (apagada) | `etapaDe` + `PESTANAS_POR_ETAPA` (3 etapas), núcleo Hoy izquierda y Praxis centro; `BARRA_POR_ETAPA_ACTIVA = false` | `src/domain/etapaDeLaBarra.ts` [V] (#432) |
| Tabla única de rutas | 46 filas con padre, título, título del equipo y guarda de rol | `src/app/rutas.ts` [V] |
| Destinos de Praxis | Salen de `RUTAS` y de `resolverAcceso`; no hay cuarta lista; excluye rutas con parámetros, redirecciones y las de Praxis | `src/app/destinosPraxis.ts` [V] |
| Navegar | `navegarA(patron, perfil, navegar)` y `navegarPorFrase`; hoy solo la orden «hoy» sale de la app; el resto mueve el salón | `src/app/navegarPraxis.ts` [V] |
| Órdenes de voz del salón | Lista cerrada sin modelo; riesgo primero; `NEGADA`; ambiguas devuelven `cual` | `src/domain/praxis/ordenes/ordenesDeVoz.ts` [V] |
| Enrutador | `enrutarPraxis` con rutas, riesgo primero | `src/domain/praxis/enrutarPraxis.ts` existe [V]; su contenido no se re-leyó para este documento |
| Libro y deshacer | `praxis_registros_aplicados` (0161), `praxis_deshacer` (0162), agua (0163); solo el dueño; confirmación | `supabase/migrations/0162_...sql` cabecera [V] |
| Puerta de Praxis | `PRAXIS_ABIERTA_A_ASESORADOS = false` | `src/domain/praxis/acceso.ts` l.36 [V] |

Qué NO hay: ninguna organización guardada por persona; ningún nombre hablado para tarjetas ni menús (la búsqueda de `nombreHablado` / `ordenPorPersona` no devolvió nada en `src`, `supabase` ni `docs`, salvo un archivo ajeno de consola) [V]; ninguna orden de voz que ordene, oculte o muestre piezas (solo navega).

## 2. Idea en una frase

Una sola capa nueva, la ORGANIZACIÓN DE LA PERSONA, que se apoya en tres cosas que ya existen (la tabla de rutas, la guarda de acceso y el libro con deshacer) y a la que Praxis solo escribe cuando la persona lo pide y confirma. No es una pantalla nueva: es el modo en que Praxis y las pantallas actuales leen «qué piezas, en qué orden, cuáles a la vista».

## 3. Los verbos (qué puede pedir la persona)

| Verbo | Qué hace | Cambia lo guardado | Confirmación |
|---|---|---|---|
| Traer / desplegar | Abre la pantalla, el menú o el cuadro AHORA, solo esta vez | No | No (reversible con «atrás»; igual que navegar hoy) |
| Fijar a la vista | Deja la pieza visible y en su sitio desde ahora | Sí | Sí (una tarjeta, dos botones) |
| Ocultar | La pieza deja de mostrarse; sigue existiendo y se puede traer hablando | Sí | Sí |
| Mover | «ponme Nutrición arriba», «mueve el agua después de la sesión» | Sí | Sí |
| Dejarlo como estaba | Deshace el último cambio de organización | Sí | Sí |
| Restablecer | Vuelve a la organización por defecto de su etapa | Sí | Sí |

Regla madre: traer no cambia nada guardado; todo lo que cambia lo guardado se propone con tarjeta y solo se aplica al pulsar, igual que `proponer` nunca guarda (precedente del deshacer, `DISENO-DESHACER-REAL-20261104.md` §4 [V]). Un cambio por orden; «ocúltame todo» se contesta «uno por vez» y se ofrece el primero.

## 4. El catálogo de piezas con nombre hablado

### 4.1 Forma de cada pieza [P]

```
Pieza {
  id: string                    // estable, en minúsculas: 'hoy.anillo', 'nutricion.diario', 'pantalla:/semana'
  tipo: 'pantalla' | 'menu' | 'area' | 'tarjeta' | 'pestana'
  nombreHablado: string         // como lo diría una persona: 'el anillo del día'
  sinonimos: string[]           // 'mi anillo', 'el círculo de hoy'
  padre: string | null          // en qué pantalla o área vive
  nivel: 'fija' | 'reordenable' | 'libre'
  quienLaVe: roles y capacidades // el MISMO oráculo de acceso que RUTAS
  bandera?: string              // si está detrás de bandera apagada, no existe para Praxis
}
```

### 4.2 De dónde sale (no una lista más)

- Pantallas: se DERIVAN de `RUTAS` y `destinosPara(perfil)`, igual que hoy `PATRONES_DESTINO`. El nombre hablado de una pantalla es su `titulo` (o `tituloEquipo`) más sinónimos escritos aparte. Si alguien cambia una puerta, Praxis la respeta sin tocar el catálogo [V, diseño de `destinosPraxis.ts`].
- Menús, áreas y tarjetas: hoy no tienen identificador. Cada uno se registra UNA vez en un archivo de catálogo por pantalla (ejemplo: Hoy), con su `id`, nombre hablado y nivel. [P]
- Regla de oro: TODA pieza nueva de diseño trae su nombre hablado y su contenedor en el mismo PR, o su prueba de inventario se pone en rojo. Mismo molde que `rutas.inventario.test.ts`, que ya exige que cada ruta esté en la tabla [V]. Así las piezas sin conectar o detrás de bandera no se vuelven huérfanas de Praxis.
- Una pieza detrás de bandera apagada NO está en el catálogo visible: Praxis no puede traer lo que la app aún no muestra.

### 4.3 Piezas de diseño del tablero de hoy y cómo entran

| PR | Pieza | Estado | Qué debe declarar para entrar al catálogo |
|---|---|---|---|
| #426 (B1) | Pestaña Praxis del equipo con el agujero negro | borrador | id, nombre hablado; nivel `fija` (Praxis es núcleo de la barra) |
| #433 (B2) | Barra con Praxis al centro | borrador, bandera | es el contenedor de las pestañas: define los «puestos» ordenables |
| #434 (C1) | Hoy con anillo y tarjetas a 22 px | borrador, bandera | `hoy.anillo` y cada tarjeta de Hoy: id, nombre hablado, orden por persona |
| #431 (C3) | Tarjetas del diario de nutrición | borrador, cambia pantalla SIN bandera (decide Bryan) | tarjetas del diario como piezas reordenables |
| #438 (C5) | Mi mercado | borrador, bandera | pieza `libre` dentro de Nutrición |
| #428, #429, #430 | Foco, MiniBarras, AnilloDelDia | fusionados, sin conectar | componentes, no piezas: se registran cuando una pantalla los use |
| #427 (B3) | Sello del laboratorio | fusionado, interruptor apagado | no entra: el asesorado no ve nada del laboratorio (decisión del 4-nov [V]) |
| #432 (C6) | `etapaDe` y regla 3 de 7 | fusionado, apagado | base de la organización por defecto |

(Estados de los PR leídos hoy con `gh pr view` [V].)

## 5. Niveles y topes de seguridad

### 5.1 Los tres niveles

| Nivel | Qué significa | Ejemplos propuestos [P] |
|---|---|---|
| `fija` | No se oculta ni desaparece, PERO SE PUEDE MOVER de sitio; sus notificaciones siguen llegando siempre, esté donde esté (Bryan, 9-nov). Excepción: el núcleo de la barra (Hoy a la izquierda, Praxis al centro) queda en su puesto, por decisión del 4-nov | Hoy y Praxis de la barra; todo lo clínico y de riesgo; avisos de derivación y líneas de ayuda; el check-in de salud; el cribado pendiente; «Derechos»; «Yo» (avisos, clave) |
| `reordenable` | Se puede mover, no ocultar | Lo que el coach marcó como parte del plan: la sesión de hoy, el plan de nutrición asignado, las revisiones |
| `libre` | Se puede traer, mover y ocultar | Anillo, tarjetas informativas, atajos, Logros, Contenidos, Progreso, Mi mercado |

### 5.2 Topes duros (no los cambia ni Praxis ni la persona)

1. Lo clínico no se oculta: una pieza con salud, riesgo o derivación es `fija` por construcción. La lista de lo `fija` la fija Bryan, no el modelo. Una pieza `fija` se puede mover; moverla o reordenarla NUNCA apaga ni retrasa sus notificaciones: las notificaciones dependen de la pieza, no de su posición ni de su visibilidad (Bryan, 9-nov). Debe tener su prueba: mover una pieza fija deja las notificaciones intactas.
2. Lo que el coach asignó (microciclo, plan) no lo oculta el asesorado; si cree que le sobra, Praxis le dice «eso lo cambia tu coach» y deja aviso al coach (cola de dudas ya existente).
3. El asesorado ve solo lo suyo: el catálogo que se le ofrece a Praxis para una persona es `destinosPara(perfil)`; una pieza de equipo (Equipo, Bandeja, Empresa, Laboratorio) no existe para un asesorado ni por nombre. «Muéstrame la bandeja» contesta como cualquier destino sin acceso: `FRASE_SIN_ACCESO`, sin desviar en silencio [V, `navegarPraxis.ts`].
4. Riesgo primero: una frase con riesgo («oculta lo del dolor de rodilla») termina en `seguridad`, nunca en organización [V, mismo orden que `ordenesDeVoz.ts`].
5. Nada se borra: ocultar es una marca en la organización; la pieza y sus datos siguen. Cumple «mover u ocultar, no borrar» [V `00-PLAN.md` l.46].
6. Nunca se cambia organización por inferencia silenciosa. Dos excepciones ya decididas: la barra por etapa cambia al pasar de etapa y Praxis lo avisa; y «foco en comida» lo propone Praxis y el coach confirma [V `DECISIONES-ENRUTADOR` l.41, 44].
7. Tope de cambios: máximo N cambios de organización por persona y hora (número lo fija Bryan; [P] 10) y máximo M piezas ocultas a la vez (para que nadie termine con una app vacía; [P] mitad de las `libre`).
8. Sin modelo para decidir: la interpretación es gramática cerrada (§6). Un modelo no puede inventar un id; si no coincide con el catálogo, no se hace.

## 6. Cómo se dice (gramática cerrada, sin modelo)

Se extiende el patrón de `ordenesDeVoz.ts`: lista cerrada, riesgo primero, `NEGADA`, normalización sin tildes. Orden de decisión [P], igual al del enrutador: riesgo, acceso, pendiente, organización, órdenes del salón, resto.

| Frase de ejemplo | Interpretación | Efecto |
|---|---|---|
| «ábreme Nutrición», «muéstrame mi plan» | traer pantalla | navega (ya existe) |
| «muéstrame el anillo del día» | traer pieza | la despliega ahora |
| «déjame siempre a la vista el agua» | fijar a la vista | tarjeta de confirmación |
| «oculta Logros» | ocultar | tarjeta de confirmación |
| «ponme Nutrición arriba» | mover | tarjeta con el antes y el después |
| «déjalo como estaba» | deshacer el último cambio de organización | tarjeta de confirmación |
| «vuelve a como venía» | restablecer | tarjeta de confirmación |
| «no me muestres Logros» | `NEGADA`: pide ocultar, pero cae en confirmación | tarjeta |
| «oculta lo del plan de entreno» | pieza `reordenable` de coach | «eso lo cambia tu coach» + aviso |
| «oculta lo del dolor» | riesgo | `seguridad`, nada se oculta |
| «oculta eso» (dos candidatos) | ambigua | hasta 3 botones, luego confirmación |
| «qué puedo ocultar» | listar | enumera solo lo `libre` de ESA persona |

Reglas de desambiguación: «espalda» y «pierna» ya devuelven `cual` en las órdenes del salón [V]; aquí, un nombre hablado que cae en dos piezas devuelve las dos (máximo 3) y pregunta. Un nombre que no está en el catálogo no se adivina: «no encontré esa parte; puedo mostrarte: ...». Esto reutiliza el mismo mecanismo que `deshacer` (candidatos y confirmación con token que vence, [V DISENO-DESHACER §3-4]).

## 7. Dónde se guarda la organización de cada persona

Requisitos: sirve desde cualquier dispositivo; la lee Praxis; la lee el equipo para dar soporte; se puede deshacer; no guarda texto libre.

| Opción | Pros | Contras | Veredicto |
|---|---|---|---|
| Navegador (`localStorage`) | Sin migración | No viaja entre dispositivos; Praxis no lo ve; se pierde al limpiar; la voz no lo comparte | No |
| Columna jsonb en `perfiles` | Una sola fila | Tabla con datos de salud y RLS amplia; cambia una tabla con datos reales | No como primera opción |
| Tabla nueva `praxis_organizacion` + historial en el libro existente | Aislada, con RLS propia, reutiliza el patrón deshacer | Exige migración (la escribe un agente, la aplica Bryan) | Recomendada [P] |

Forma propuesta [P]:

```
praxis_organizacion (una fila por persona)
  usuario_id    uuid (clave, = auth.uid())
  version       int   // sube con cada cambio; sirve para detectar choque entre dispositivos
  barra         text[]            // ids de pestañas, tras el núcleo fijo
  orden         jsonb             // { contenedor_id: [ids de piezas en orden] }
  ocultas       text[]            // ids de piezas libres ocultas
  actualizado_en timestamptz
```

- Solo ids del catálogo, sin texto libre: la columna no contiene nada que identifique a la persona más allá de su `usuario_id` [P].
- El servidor valida cada escritura: ids contra el catálogo de ESA persona, ninguna `fija` en `ocultas`, tope de largo y de cambios por hora. La RLS no basta (la de `hidratacion` deja escribir al coach en filas ajenas, `DISENO-DESHACER-REAL` §5 [V]): la función comprueba `usuario_id = auth.uid()`.
- Historial y deshacer: cada cambio escribe en el libro (`praxis_registros_aplicados`) el `antes` y el `despues`; «déjalo como estaba» restituye el `antes` si el estado actual todavía es el `despues` (si cambió en otro dispositivo, dice «ya cambió después, no lo toqué»). El libro de la 0161 tiene un `check` por tipo, así que añadir el tipo `organizacion` pide su migración, igual que pasó con agua (0163) [V que agua llevó migración propia].
- Capas, de menor a mayor prioridad: (1) organización por defecto de la etapa (`PESTANAS_POR_ETAPA`); (2) organización de la persona; (3) lo `fija` y lo asignado por el coach, que siempre gana. La capa 2 nunca puede ocultar la 3.
- Qué pasa al cambiar de etapa: la barra por etapa cambia solo en las pestañas que la persona no fijó a mano; Praxis lo avisa (decisión ya tomada [V]). Lo que la persona eligió explícitamente se respeta.
- Reestructuración del plan: el equipo (coach) puede fijar una pieza `reordenable` para una persona (por ejemplo, el plan de nutrición); eso vive aparte, en lo asignado, no en `praxis_organizacion` [P, a decidir con Bryan].

## 8. Medición (acordada: «reorganizar ya y medir desde ahí»)

Contador mínimo desde el primer cambio, sin texto del asesorado: cuántas veces se trae, fija, oculta, mueve y deshace cada `id`; cuántas veces se deshace de inmediato (señal de que Praxis entendió mal). Con eso se decide qué ofrecer por defecto y qué piezas nadie usa. No se cruza con salud. [P]

## 9. Muestra para aprobar con Bryan (diálogos, sin pantalla ni código)

Estos ocho diálogos son la muestra: si Bryan los aprueba, el diseño se ajusta a ellos. Valores de ejemplo inventados.

1. Traer: persona «muéstrame el agua de hoy». Praxis abre la tarjeta de agua en Hoy, sin guardar nada.
2. Fijar: «déjame el agua siempre arriba». Tarjeta: «Voy a poner el agua arriba en Hoy, antes de la sesión. ¿Lo dejo así?» [Sí, ponerla] [No, dejarlo].
3. Ocultar libre: «oculta Logros». Tarjeta: «Voy a ocultar Logros. Lo puedes traer cuando quieras diciéndome muéstrame Logros.» [Sí, ocultarlo] [No].
4. Ocultar fijo: «oculta mis avisos». Praxis: «Esa parte no se oculta, es para cuidarte. Si te molesta, dime qué te molesta y se lo cuento a tu coach.»
5. Asignado por el coach: «quita mi plan de entreno». Praxis: «Eso lo decide tu coach. Le dejo el aviso.»
6. Riesgo: «oculta lo de la rodilla que me duele». Gana seguridad; no se oculta nada; sigue el aviso al coach.
7. Deshacer: «déjalo como estaba». Tarjeta con el antes y el después; al pulsar, vuelve el orden anterior.
8. Ambigua: «oculta eso» con dos piezas posibles. Praxis pregunta con dos botones, no elige sola.

## 10. Pruebas (se escriben antes de construir)

Para cada verbo: caso positivo directo, negativo cercano (misma palabra, otro significado), borde con seguridad.

| # | Caso | Debe pasar |
|---|---|---|
| 1 | «muéstrame el agua» | traer, 0 escrituras |
| 2 | «oculta Logros» y se pulsa Sí | `ocultas` lleva solo `logros`; el resto idéntico byte a byte |
| 3 | «oculta mis avisos» | rechazado, 0 escrituras |
| 4 | «oculta lo del dolor» | gana seguridad, 0 escrituras |
| 5 | Persona asesorada pide «muéstrame la bandeja» | sin acceso; no se crea ni se oculta nada |
| 6 | Orden sin pulsar nada | 0 escrituras; la tarjeta caduca |
| 7 | Token reusado o de otra persona | rechazado, 0 escrituras |
| 8 | Coach intenta cambiar la organización de un asesorado | rechazado |
| 9 | «no me muestres Logros» | se trata como pedido de ocultar con confirmación, no como orden de traer |
| 10 | «mi hermano ocultó todo» | no dispara |
| 11 | Dos dispositivos cambian a la vez | el segundo ve «ya cambió después» |
| 12 | Pieza nueva sin nombre hablado | la prueba de inventario falla |
| 13 | Ocultar más de M piezas | rechazado con motivo |
| 14 | Pieza detrás de bandera apagada | no aparece en el catálogo, no se puede traer |

Ver fallar a propósito (regla del proyecto: ningún check cuenta verde hasta verlo rojo): mutar la comprobación de `nivel = fija` y ver caer el caso 3; mutar el filtro por rol del catálogo y ver caer el caso 5; mutar la comprobación de `usuario_id` y ver caer el caso 7.

Medida de éxito: la fija Bryan antes de construir. Propuesta para su firma: 0 piezas fijas ocultas, 0 cambios sin confirmación, 0 filtraciones de piezas de equipo a un asesorado, sobre los casos 1 a 14. Sin umbral blando en estas tres.

## 11. Fases, costo y dependencias

| Fase | Entrega | Migración | Modelo de pago |
|---|---|---|---|
| O0 | Aprobar la muestra (§9), el nivel de cada pieza y las cifras de tope | No | 0 |
| O1 | Catálogo de piezas con nombre hablado (pantallas derivadas de `RUTAS`; Hoy primero) y prueba de inventario | No | 0 |
| O2 | Gramática de organización en el enrutador, en SOMBRA (decide y registra, no actúa) | No | 0 |
| O3 | Medidas de §10 sobre frases propias y las ya firmadas de riesgo | No | 0 |
| O4 | Migración de `praxis_organizacion` y del tipo `organizacion` en el libro (la escribe un agente, la aplica Bryan a mano) | Sí | 0 |
| O5 | Aplicar y deshacer reales, detrás de bandera, solo equipo | No (usa O4) | 0 |
| O6 | Que pantallas lean la organización (Hoy primero), detrás de bandera | No | 0 |
| O7 | Abrir a asesorados | — | depende de `PRAXIS_ABIERTA_A_ASESORADOS` y de la revisión ciega de Bryan |

Todo es apagado y sin modelo de pago hasta O7. Dependencias: #433 (barra) y #434 (Hoy) para O6; la decisión de Bryan sobre #431; que `PRAXIS_ABIERTA_A_ASESORADOS` siga en `false` (nadie asesorado ve nada de esto antes de O7).

## 12. Decisiones de Bryan (9-nov, por selector) y las que siguen abiertas

Decididas: (1) traer sin confirmación; fijar, ocultar, mover, deshacer y restablecer con confirmación. (2) El coach puede fijar una pieza `reordenable` a un asesorado y se anota en lo asignado, no en `praxis_organizacion`. (3) Si la persona fijó la barra a mano y cambia de etapa, se respeta lo que eligió y Praxis avisa. (4) Los ocho diálogos de la §9 se muestran como artifact.

(5) Corrección de Bryan del 9-nov: las áreas fijas no desaparecen pero SÍ se pueden mover, y siguen mandando notificaciones. La lista concreta de fijas se propone en el simulador https://claude.ai/artifact/KR3ad4mpy8CLZAjy47rhWv y Bryan la aceptó tal cual (respuesta «1 a»).

(6) Hoy y Praxis del núcleo de la barra NO se mueven, quedan en su puesto (Bryan, 9-nov). (7) El catálogo completo y la tabla de datos van en los anexos A y B de este documento.

(8) Tema aparte, decidido por Bryan el 9-nov: el ranking del equipo de Logros (`RankingEquipo`) ya muestra a cada asesorado las posiciones del equipo, y choca con «el asesorado ve solo lo suyo». El catálogo lo registra como libre y no lo cambia; si un asesorado debe ver a otros se decide fuera de este diseño.

(9) Tope de piezas ocultas a la vez: 6 (Bryan, 9-nov). (10) La sombra de la decisión de organización se registra desde el cliente, sin tocar la Edge Function (Bryan, 9-nov). (11) Se mide con una muestra de 20 frases que Bryan etiqueta a ciegas; las frases las escribe Claude y no cuentan para aprobar.

(12) Lo que aprendimos de las 20 frases que Bryan etiquetó a ciegas el 9-nov: «qué tengo escondido» debe listar lo que la persona ya ocultó; una queja («me aburre el álbum») hace que Praxis OFREZCA esconderlo, sin mandarlo; «pon el agua» sin lugar es traer; «borra», «elimina» y «no quiero que me salga» esconden; «regrésame todo como venía» restablece. Quedan abiertas «quita eso» (choca con el deshacer de registros) y «déjame ver solo lo importante» (un modo que este diseño no tiene).

Siguen abiertas:

1. Lista de lo `fija` (qué piezas jamás se ocultan). Mi propuesta está en §5.1.
2. ¿El coach puede fijar una pieza `reordenable` a un asesorado y dónde se anota? (§7, último punto).
3. Topes: cambios por hora (propuesta 10) y piezas ocultas a la vez.
4. «Traer» sin confirmación y «fijar, ocultar, mover» con confirmación (§3). ¿Se mantiene?
5. Qué hacer cuando la persona cambia de etapa y había fijado la barra a mano (§7: se respeta lo explícito y Praxis avisa).

## 13. Verificado, no verificado, no encontré

Verificado hoy en main e1c0d402 (rama `spec/praxis-interactiva`, worktree `alpha-spec-interactiva`): `etapaDeLaBarra.ts` completo; `destinosPraxis.ts` y `navegarPraxis.ts` completos; `ordenesDeVoz.ts` l.1-80; `rutas.ts` l.1-110 y el conteo de 46 filas con `patron:`; `BottomNav.tsx` l.1-60; `acceso.ts` l.36; cabecera de la 0162; lista de rutas del router; estados de los PR #425 a #438 con `gh pr view`; `DISENO-ENRUTADOR-REAL-20261104.md` y `DISENO-DESHACER-REAL-20261104.md` completos; `DECISIONES-ENRUTADOR-20261104.md` l.30-54; `00-PLAN.md` l.38-57; `piezas-diseno/C1.md`.

No verificado: contenido de `enrutarPraxis.ts` y de los demás archivos de `src/domain/praxis/`; las tarjetas concretas de Hoy y sus archivos (solo vi tres nombres en `HoyPage.tsx`); el `check` de tipos del libro 0161 (se afirma por la cabecera de 0162 y la historia de agua 0163); qué piezas trae cada PR de diseño más allá de su título; que nadie haya diseñado ya algo parecido en otra rama.

No encontré: un identificador por tarjeta o menú; nombres hablados; una tabla de preferencias de interfaz por persona; una orden de voz que oculte o reordene.

## 14. Lo que NO se tocó

Ciclo, `gasto.json` y `f4-medicion` (línea A); `riesgo.ts`; Edge Function; migraciones (ninguna); ramas ajenas; #431, #426, #433, #434, #438 (solo se leyó su título y estado).

## Anexo A. Catálogo completo de piezas (propuesta de niveles, aceptada por Bryan el 9-nov)

Fuente: simulador https://claude.ai/artifact/KR3ad4mpy8CLZAjy47rhWv. Los nombres de pantallas y tarjetas salen de `rutas.ts` y de las páginas de main e1c0d402 [V]; los sinónimos hablados son propuesta mía [P]. Reglas: fija = no se oculta, sí se mueve, sus notificaciones siguen; el núcleo de la barra (Hoy y Praxis) no se mueve (Bryan, 9-nov); asignada = la puso el coach, se mueve y no se oculta; libre = se trae, mueve y oculta; equipo = solo coach y nutricionista; apagada = detrás de bandera, no existe para Praxis.

| Área | Pieza (nombre hablado) | Sinónimos | Nivel | Rol | Origen o nota |
|---|---|---|---|---|---|
| Hoy (/) | la sesión de hoy | mi sesion, mi entreno de hoy | asignada | asesorado | Tarjeta de sesión (TarjetaSesionDeHoy) |
| Hoy (/) | el check-in del día | mi check in, como amanecí | fija | asesorado | Lleva dolor y sueño: clínico |
| Hoy (/) | la nutrición de hoy | mi comida de hoy, lo que como hoy | asignada | asesorado | Plan asignado |
| Hoy (/) | el anillo del día | mi anillo, el circulo de hoy | apagada | asesorado | #434, detrás de bandera |
| Hoy (/) | la tarjeta de la semana | mi semana en hoy | libre | asesorado | TarjetaDeLaSemana |
| Hoy (/) | la pregunta del coach | lo que me pregunto el coach | asignada | asesorado | TarjetaPregunta |
| Hoy (/) | el resto del día | lo demas de hoy | libre | asesorado | ElResto |
| Entrenar (/entrenar) | mi ruta de entreno | mi microciclo, mi plan de entreno, el plan de entreno | asignada | asesorado | Microciclo del coach |
| Entrenar (/entrenar) | la sesión | mi sesion de entreno | asignada | asesorado | /entrenar/sesion |
| Entrenar (/entrenar) | el salón | el cuerpo 3d, el salon 3d, el sujeto | libre | asesorado | Cuerpo 3D del asesorado; sin cifras mecánicas |
| Entrenar (/entrenar) | las notas de la semana | mis notas del entreno | libre | asesorado | NotasDeLaSemana |
| Nutrición (/nutricion) | el diario de comidas | mi diario, mis comidas | asignada | asesorado | DiarioDia |
| Nutrición (/nutricion) | el resumen del día | mis calorias, mis macros | libre | asesorado | ResumenDia |
| Nutrición (/nutricion) | el agua | mi agua, la hidratacion | libre | asesorado | Hidratacion |
| Nutrición (/nutricion) | los micronutrientes | mis micros, mis vitaminas | libre | asesorado | PanelMicros |
| Nutrición (/nutricion) | la calibración | mi calibracion | libre | asesorado | PanelCalibracion |
| Nutrición (/nutricion) | mi plan de nutrición | el plan de comida, mi plan de comida | asignada | asesorado | /nutricion/plan, lo arma el nutricionista |
| Nutrición (/nutricion) | las recetas | mis recetas | libre | asesorado | RecetasCarousel |
| Nutrición (/nutricion) | mi mercado | el mercado de 15 dias, la lista del mercado | apagada | asesorado | #438, detrás de bandera |
| Nutrición (/nutricion) | Al día | al dia embarazo | fija | asesorado | Solo con el perfil que la activa; contenido clínico |
| Semana (/semana) | el resumen de la semana | mi resumen | libre | asesorado | aria: Resumen de la semana |
| Semana (/semana) | mi semana día por día | los dias de la semana | libre | asesorado | aria: Tu semana, día por día |
| Semana (/semana) | lo que me toca responder | mis pendientes | asignada | asesorado | Preguntas del equipo |
| Semana (/semana) | las notas de la semana | notas de mi semana | libre | asesorado | aria: Notas de la semana |
| Semana (/semana) | el chat con mi equipo | mensajes con mi coach | fija | asesorado | Canal con el coach: no se oculta |
| Progreso (/progreso) | la fatiga por grupo muscular | mi fatiga, mi cansancio muscular | libre | asesorado | aria: Fatiga por grupo muscular |
| Progreso (/progreso) | mis medidas y peso | mi peso, mis medidas | libre | asesorado | MedidasCard |
| Progreso (/progreso) | mis logros | logros, mis medallas | libre | asesorado | aria: Tus logros |
| Progreso (/progreso) | el progreso al siguiente nivel | mi nivel | libre | asesorado | Barra de nivel |
| Bienestar (/bienestar) | el formulario de check-in | mi check in diario | fija | asesorado | CheckinForm: incluye dolor |
| Bienestar (/bienestar) | mi estilo de vida | mi vida, mis habitos | libre | asesorado | TarjetaVidaCard |
| Otras pantallas | el chat | mensajes, mi coach por chat | fija | asesorado | /chat |
| Otras pantallas | los cuestionarios | mis cuestionarios, mis encuestas | asignada | asesorado | Los asigna el equipo |
| Otras pantallas | los contenidos | mis videos, mis lecturas | libre | asesorado | /contenidos |
| Otras pantallas | la pantalla de logros | pantalla de logros, logros | libre | asesorado | /logros |
| Yo (/yo) | mis avisos | mis notificaciones | fija | asesorado | AvisosYo |
| Yo (/yo) | cambiar la clave | mi contrasena, mi clave | fija | asesorado | CambiarClave |
| Yo (/yo) | tus datos y derechos | mis datos, mis derechos | fija | asesorado | Exigido por el abogado |
| Espacio del equipo | la cartera de asesorados | mi equipo, mis asesorados | equipo | equipo | /equipo |
| Espacio del equipo | la bandeja | mis tareas, mis firmas | equipo | equipo | Tareas, mensajes y firmas |
| Espacio del equipo | la empresa | las herramientas | equipo | equipo | Según permisos |
| Espacio del equipo | mi día | mi dia de equipo | equipo | equipo | Hoy del equipo |
| Espacio del equipo | mi entreno del equipo | mi entreno de coach | equipo | equipo | /mi-entreno |
| Espacio del equipo | las revisiones | mis revisiones | equipo | equipo | Firma de audios y vídeos |
| Espacio del equipo | el laboratorio | el lab | apagada | equipo | Apagado: el asesorado no ve nada |

Conteo: 45 piezas (8 fija, 9 asignada, 19 libre, 6 equipo, 3 apagada).

## Anexo B. Datos que Praxis puede traer o registrar

El estado de guardado sale de `DISENO-DESHACER-REAL-20261104.md` §1 [V] (series y adherencia se guardan de verdad hoy) y del traspaso del 9-nov [M] (dictado v38 de pasos y sueño); agua y comida siguen en curso. No se verificó contra la base real.

| Dato | Dónde vive | Traer | Registrar hablando | Nivel | Nota |
|---|---|---|---|---|---|
| Peso | Check-in y Medidas | Sí (número y curva) | Propone tarjeta | libre | Un número: se arrastra del día anterior si no lo mueves |
| Pasos | Check-in | Sí | Propone tarjeta (ya dictado en la v38) | libre | «Suelo caminar 6 mil, hoy 9 mil» anota 9.000 |
| Horas de sueño y hora de acostarse | Check-in | Sí | Propone tarjeta (dictado v38) | libre | «Normalmente duermo 7» no anota nada |
| Calidad del sueño, rendimiento, motivación | Check-in | Sí | Propone tarjeta | libre | Escala cualitativa |
| Hambre, cansancio, estrés, alimentación | Check-in | Sí | Propone tarjeta | libre | Escala cualitativa |
| Dolor y dónde | Check-in | Sí, a quien corresponde | Propone y avisa al coach | fija | Clínico: no se oculta; una frase de dolor va a seguridad, no a organización |
| Comentarios del check-in | Check-in | Solo el coach | No se dicta a ciegas | fija | Texto libre: nunca se copia a archivos ni a modelos externos |
| Agua (ml) | Nutrición | Sí | Propone y deshace (0163); guardado en curso | libre | Total por día, no por vaso |
| Comidas, kcal y macros | Nutrición | Sí | Propone tarjeta; guardar espera prerrequisitos | asignada | El plan lo arma el nutricionista |
| Series: carga, repeticiones y RIR | Entrenar | Sí | Guarda de verdad y se deshace (0162) | asignada | Lo asigna el coach |
| RPE y duración de la sesión | Entrenar | Sí | Guarda por la vía de la app | asignada | Fuera del libro por ahora |
| Adherencia (hoy y ayer) | Entrenar y Semana | Sí | Guarda de verdad y se deshace (0162) | libre | Marca sí, parcial o no |
| Medidas corporales | Progreso y Bienestar | Sí | Propone tarjeta | libre | Solo lo propio |
| Fatiga por grupo muscular | Progreso | Sí (gráfica) | No se registra hablando | libre | Se calcula, no se anota |
| Logros y nivel | Progreso | Sí | No se registra hablando | libre | Se calcula de los datos; deshacer baja los puntos solos |
| Cuerpo 3D (salón) | Entrenar | Sí (traer el salón) | No | libre | El asesorado no ve cifras mecánicas |
| Avisos, derechos y clave | Yo | Sí | No | fija | No se ocultan |
| Datos de otros asesorados | Equipo | Solo el equipo | No | equipo | Un asesorado jamás los ve ni por nombre |

## Anexo C. Corrida intensiva del 10-nov: hallazgos y decisiones de Bryan

Tres agentes de solo lectura (auditoría de notificaciones, revisión adversarial, 285 frases habladas escritas a ciegas) y una prueba de estrés propia. Detalle y cifras en el PR #472.

Hallazgos corregidos en el código (#472): una pantalla libre que contiene piezas fijas o asignadas no se oculta (el contenedor hereda lo más estricto); «de hoy» no nombra la pantalla Hoy cuando la frase nombra una tarjeta; «borra» y «elimina» solo esconden la tarjeta y la decisión lo marca; «solo lo importante» solo vale si la frase termina ahí; «Al día» es fija; el nivel de cada pieza está congelado en una prueba.

Notificaciones [leído por un agente, sin ejecutar]: los push salen del servidor (`avisos-plan`) y no dependen de piezas en pantalla. Dependen de que la pieza se vea: el contador de no leídos de `BarraCoach`, el aviso de datos sin subir (`AvisoSinSincronizar`) y la puerta de alta de avisos de Hoy (`PedirPermiso`). El recordatorio de las 6 pm se apaga solo si ya hay check-in del día, así que el check-in debe seguir alcanzable.

Gramática por reglas: 71 % de acierto en frases libres de examen (142), 0 falsos positivos de salud o de otro tema, 0 de 5.000 combinaciones de riesgo con órdenes organizan algo. Es el camino rápido; lo demás no se resuelve con más reglas.

Decisiones de Bryan (10-nov, por selector):
- (13) Las piezas fijas con señal propia (contador de mensajes sin leer, aviso de datos sin subir) se pueden mover, pero su señal sube a la barra de abajo para que se vea siempre. Falta diseñarlo y construirlo.
- (14) Ocultar el peso o las medidas se permite con confirmación y el coach recibe un aviso corto SIN la frase (puede ser señal de conducta alimentaria). Falta definir el canal del aviso (`praxis_avisos_coach`, 0108) y su texto, que redacta Bryan.
- (15) Lo que la gramática no entiende se pregunta («¿qué quisiste decir?») y, cuando el modelo propio esté listo, lo toma él. Sin modelo de pago.

Siguen abiertas, sin decisión: qué pasa si el coach asigna algo dentro de un contenedor que la persona ya ocultó; ids guardados de piezas que dejan de existir (cuentan para el tope y no se listan); el historial de check-ins (`progreso.checkins`, `bienestar.historial`) es libre y contiene dolor y sueño; dos dispositivos que ocultan a la vez (el servidor debe recontar el tope); y la fuga de existencia («sin acceso» frente a «no existe»).
