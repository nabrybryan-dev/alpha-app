# Praxis responde dudas libres en Entrenar, solo para el equipo (30-oct-2026)

## Por qué

Bryan, 30-oct: que Praxis responda «cualquier duda», reforzada con su modelo y con los conceptos de
referencia de los cerebros. Eligió esto frente a preguntas fijas o fijas más 50 fichas. Encargo:
`F:\alpha-corridas\REDISENO-APP-20261021\19-ENCARGO-PRAXIS-DUDAS-LIBRES.md`.

## Lo escrito y cómo lo cumple este diseño

| Lo escrito | Dónde | Cómo se cumple |
|---|---|---|
| Solo para el equipo | `acceso.ts:36`, encargo | `PuertaDeDudas` usa `puedeVerPraxis`; el interruptor no se toca |
| La función cierra por su cuenta | `praxis-registro/index.ts:992` | Sin cambios: un asesorado recibe 403 aunque llame directo |
| El filtro de riesgo va primero | `riesgo.ts:7` | `dudaAntesDeEnviar` corre antes de la red; la función vuelve a filtrar |
| Ante la duda gana lo más protector | `riesgo.ts:11` | La marca del servidor se respeta con `pasoTrasProponer` |
| Tras una Quieta, hoy no hay más preguntas | `motor/senales.ts:117` | El campo se cierra hasta mañana en ese teléfono, sin botón de reabrir |
| Ficha de salud no se contesta | `consultas/portero.ts:12` | Sin cambios: lo hace la función |
| Solo `respuesta_directa` y `senal_alarma` | `consultas/portero.ts:10` | Sin cambios: nunca sale una ranura sin llenar |
| La guía no gasta la clave | `zonasDePraxis.test.ts:102` | El test sigue igual: el campo vive en otro archivo y entra por una ranura |
| Las preguntas fijas se quedan | encargo | `PasoDePraxis` no cambia |
| No inventa | encargo | Si no hay ficha lo dice. La charla libre del modelo no pasa como respuesta |
| Un dominio no importa de otro | `CLAUDE.md` §3 | La lógica está en `domain/praxis/dudas`; la única excepción es `usePuestoCoach`, igual que en `features/nutri` |

## El arreglo que hacía falta antes

`pasoTrasProponer` convertía toda consulta en «no lo sé», incluso cuando el portero ya la había contestado:
la respuesta llegaba en `tarjeta.mensaje` y se descartaba. Ahora el cliente lee `meta.portero` y muestra
la ficha. También arregla la pantalla de Praxis del equipo, cuando esto se una.

## Corte vertical (este PR)

Sin migración y sin desplegar la función: usa `praxis-registro` v21 tal como está.

1. El equipo escribe en el panel de Praxis, en Entrenar.
2. Filtro de riesgo en el teléfono.
3. `praxis-registro`: repite el filtro, lee con el modelo y consulta al portero.
4. Se muestra la ficha, o «no lo sé». Si la frase es un registro, se manda a la hoja de series.
5. Registro: la línea `praxis-registro: portero <resultado>` y, si el portero duda o no halla ficha, la fila de `praxis_cola_dudas`.

## Lo que este corte todavía no hace

- **No ahorra clave.** Cada frase que pasa el filtro local hace 2 llamadas a Haiku (registrador y lector de riesgo), aunque el portero acierte. El lector de riesgo es firmado: se queda.
- **No responde con Haiku.** Sin ficha dice «no lo sé».
- **No usa el contexto del día.** Solo viaja la frase, porque el portero solo lee la frase.
- **Las opciones de `aclarar` son texto.** Si la persona contesta «1», la frase llega sola y no se entiende.
- **Una respuesta con ficha no deja fila en la base**, solo la línea de registro.
- **Quieta y salud detectadas en el teléfono no avisan a nadie**, igual que hoy en Praxis, y la pantalla lo dice.

## Origen de la respuesta y «No era esto»

`encolarDuda` no guarda las consultas con `atender`: una ficha equivocada con seguridad no llegaba a nadie. Por eso
el panel dice de qué ficha salió la respuesta y ofrece «No era esto», que escribe en `praxis_cola_dudas` con
`origen = 'no_era_esto'`. Requiere la migración 0151, sin aplicar; mientras falte, el panel dice que no pudo anotarlo.
Esas filas no tienen juez: el taller las descarta y las revisa una persona.

## Pasos siguientes

Cada uno con su medida fijada antes y su sí cuando toque producción.

1. **Acción `duda` en `praxis-registro`** (requiere desplegar): filtro, lector de riesgo, portero. Quita la llamada al registrador: de 2 a 1 llamadas por frase. El trinquete tiene congelados `index.ts` en 1.048 líneas y `manejar` y `proponer`: antes hay que sacar piezas de ese archivo.
2. **Conceptos aprobados.** Bryan elige de `cerebro-alpha/wiki/conocimiento/` qué entra, con su fuente. Los cerebros no se entregan crudos.
3. **Haiku con respaldo.** Responde solo con fichas y conceptos aprobados, cita la fuente y, si no hay respaldo, va a la cola. Mismo tope de 60 por hora.
4. **Contexto del día.** Ejercicio y prescripción, con lo mínimo necesario.
5. **Medida.** Preguntas reales de entreno del equipo, con el criterio escrito antes de correrlas.

## Antes de abrir a asesorados

No se abre con este trabajo. Siguen las condiciones de `acceso.ts:25-32` más el portero, que hoy vive en un portátil.

## Dónde están los cerebros (comprobado el 30-oct)

`C:\Users\ASUS\dev\cerebro-alpha\wiki\`: `conocimiento/`, `motor-decision/` y `centro-respuestas/`.
Las rutas relativas de `CLAUDE.md` §8 no resuelven desde este worktree, y `Cerebro Programacion Alpha` no aparece en esa ruta.
