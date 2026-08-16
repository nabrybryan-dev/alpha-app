# Código sin enchufar: cuatro módulos correctos que no usaba nadie

**Fecha:** 2026-08-12
**Estado:** detector escrito y en verde; la lista de excepciones se sembró **midiendo**,
no auditando una por una.

---

## Qué pasó

En tres días, cuatro veces el mismo patrón: código correcto, con sus tests en verde, que
no estaba conectado a nada.

| Qué | Cuánto tiempo suelto | Consecuencia |
|---|---|---|
| Veto de embarazo | escrito y probado | no había sitio donde declarar la condición |
| La condición declarada | días | no llegaba a la columna que lee el motor |
| `seContraindica` | desde el 2026-08-09 | **casi le proponemos hígado a una embarazada** |
| `despensa.ts` | desde el 2026-08-05 | módulo completo, 8 exportaciones, 0 consumidores |

Ningún test lo notó, y no por descuido: **cada pieza pasa sus pruebas por separado**. La
suite comprueba que cada módulo hace lo que dice, nunca que alguien lo llame. Es un hueco
estructural del arnés, no un olvido de quien escribió los tests.

## Qué se comprobó, no lo que se supone

Corriendo el detector sobre dos commits reales:

| Commit | Módulos huérfanos | Exportaciones muertas | ¿Sale `seContraindica`? |
|---|---|---|---|
| `4bc65db` (antes del arreglo) | `despensa.ts` | 20 | **sí** |
| `29627f4` (después) | `despensa.ts` | 19 | no |

Es decir: el detector habría marcado en rojo el fallo del hígado el día que se escribió.

## Las dos señales, y por qué son dos

El primer intento contaba «exportaciones que nadie importa» y daba **122**. Inservible: la
mayoría eran cosas como `tmb`, que `tmbCombinada` llama dos líneas más abajo dentro del
mismo archivo. Eso no es código muerto, es un `export` más ancho de lo necesario.

Separadas quedan así:

- **Módulo que no importa nadie** (1 hoy: `despensa.ts`). Es la señal cara: el módulo
  entero existe, pasa sus pruebas y la app no lo usa.
- **Exportación muerta** (19 hoy): nadie la usa fuera **y su propio módulo tampoco la
  llama**. El uso interno se comprueba de verdad, recorriendo los identificadores.

Los tipos e interfaces quedan fuera: se borran al compilar y «sin consumidor» no significa
lo mismo para ellos.

## Por qué con el compilador y no con regex

Un `import` partido en varias líneas, un `import { a as b }`, un `export … from`, un
`import()` de `React.lazy`: cualquiera de los cuatro engaña a una expresión regular. Un
detector con falsos positivos se acaba desactivando, y entonces no detecta nada. Se parsea
con la API de TypeScript, que ya es dependencia del proyecto y es JavaScript puro — no
entra en conflicto con la restricción de WDAC (§1 de `CLAUDE.md`).

## No prohíbe: obliga a escribir el motivo

A veces un huérfano es legítimo: algo a medio construir y anunciado, una constante que
documenta. Lo que no es legítimo es que nadie se entere. Por eso las excepciones viven en
dos listas con un motivo escrito al lado, y **un tercer test exige que la entrada
desaparezca cuando deja de ser huérfana**, para que la lista no se pudra.

Tres de las 19 tienen motivo real (esperan al aviso de frecuencia del hígado y a la
pregunta del ciclo). Las otras 16 están marcadas `HEREDADO 2026-08-12, sin revisar`: es
una línea base honesta, del mismo tipo que los umbrales-trinquete de cobertura en
`vitest.config.ts`. Su trabajo es impedir que aparezcan **nuevas**, no bendecir las viejas.

## Archivos

| Archivo | Qué es |
|---|---|
| `scripts/codigo-huerfano.mjs` | el detector; funciones puras + recorrido de disco |
| `scripts/codigo-huerfano.d.mts` | sus tipos, a mano (mismo patrón que `semilla-sql`) |
| `src/test/codigo-huerfano.test.ts` | las dos listas con sus motivos + 8 tests del parser |

## Lo que queda

- Decidir la despensa: terminarla (correr la migración 0024 y enchufar la sección) o
  borrarla. Mientras siga saliendo `NO` en cada comprobación, enseña a ignorar los `NO`.
- Resolver las 16 entradas `HEREDADO` al tocar cada módulo.
- Considerar extender la vigilancia a `src/data/` cuando esta se asiente en el dominio.
