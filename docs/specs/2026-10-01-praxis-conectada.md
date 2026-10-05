# Praxis conectada a datos y cerebro reales (1-oct-2026)

**Estado:** construido en la rama `feat/praxis-conexion`, detrás del interruptor de staff.
Nada aplicado ni desplegado. Los pasos para producción están en `PASOS-DE-BRYAN.md`.

**Diseños de los que sale** (fuera del repo, en `auditoria-alpha-20260919/vigia-codex/estilo-de-vida/`):
`DISENO-REGISTRO-NATURAL.md`, `praxis-conoce-tu-plan/DISENO.md` y `DECISIONES.md`,
`superagente/LEEME-SUPERAGENTE.md`, `lenguaje/respuestas-seguridad/BASE-RESPUESTAS-SEGURIDAD.md`.

## Qué cambia para quien la usa

Solo para el staff (`puedeVerPraxis`). Para los asesorados, nada.

| Antes (PR #330) | Ahora |
|---|---|
| Semana, mes y cifras de ejemplo | Los check-ins de la persona con sesión, de los últimos 14 días. Un día sin check-in es un hueco. |
| Check-in guiado que no guardaba nada | Conversación libre: lo escrito va al registrador, vuelve una propuesta y se guarda solo al tocar «Guardar». |
| Riesgo detectado con la lista de la maqueta | Un solo filtro por reglas (`domain/praxis/riesgo.ts`), antes de cualquier modelo. |
| «Bryan ya recibió tu frase» | «Desde aquí todavía no se le avisa a nadie»: es lo que pasa hoy. |
| — | Preguntas del plan contestadas sin modelo, citando lo escrito. |
| — | «¿Se lo pregunto a tu coach? Te aviso cuando responda», sin nombres. |

## El orden de un turno

```
frase
  ├─ 0. filtro de riesgo por reglas ── quieta | pregunta de cuidado | salud ──▶ FIN (no sale del teléfono)
  ├─ 1. ¿es una pregunta? ── se contesta del plan, con la lista blanca, sin modelo ──▶ FIN
  └─ 2. registrador (Edge Function) ── filtro clínico otra vez ─▶ Haiku ─▶ propuesta ─▶ tarjeta
                                                                              └─ «Guardar» ─▶ /guardar
```

Está en `domain/praxis/conversacion.ts` (`decidirTurno`). Cada salida lleva escrito
`vaAlModelo`, y solo `registrar` lo trae en `true`.

## Dónde vive cada cosa

| Capa | Archivo | Qué decide |
|---|---|---|
| Dominio | `domain/praxis/riesgo.ts` | Qué frase detiene, cuál se pregunta y cuál es de salud. Las cuatro líneas verificadas. |
| Dominio | `domain/praxis/plan/listaBlanca.ts` | Qué puede leer Praxis de una persona, campo por campo. |
| Dominio | `domain/praxis/plan/responder.ts` | Qué contesta del plan sin modelo, y qué no contesta. |
| Dominio | `domain/praxis/enEspera.ts` | Cómo se arma la pregunta en espera y a qué rol va. |
| Dominio | `domain/praxis/conversacion.ts` | El orden del turno y qué se muestra con lo que devuelve el registrador. |
| Datos | `data/praxis/fuente.ts` | Lee el almacén local y lo pasa por la lista blanca. |
| Datos | `data/praxis/registrador.ts` | Cliente de la Edge Function. |
| Datos | `data/praxis/preguntasEnEspera.ts` | Escribe y lee la bandeja (migración 0105). |
| Pantalla | `features/praxis/conexionReal.ts` | Junta lo anterior en la conexión que recibe la escena. |
| Pantalla | `features/praxis/motor/conversacion.ts` | Pinta el turno. |
| Pantalla | `features/praxis/motor/fuenteReal.ts` | Arma la semana real para la portada. |

## Decisiones tomadas aquí, y por qué

1. **La lista blanca es por copia, no por resta.** Cada campo que sale está escrito a mano.
   La RLS deja a la persona leer su plan `propuesto` y notas del staff; no sirve de filtro.
2. **El check-in guiado no se monta.** El registrador no puede guardar un check-in por
   partes (P2), y un flujo que pregunta cuatro turnos y luego no guarda sería peor que no
   tenerlo. El código sigue en `motor/` y lo cubren sus pruebas con la escena de ejemplo.
3. **Catorce días, no un mes.** Es la ventana que fija el diseño para lo registrado.
4. **Lo de salud se queda en el teléfono.** La pantalla filtra antes de llamar al servidor.
   El servidor vuelve a filtrar: si deriva por crisis algo que la pantalla dejó pasar, gana
   el más protector y sale la Quieta.
5. **Los textos no prometen lo que no existe.** Los del registrador dicen «le aviso a Bryan»
   y hoy no hay aviso. La pantalla usa textos propios, sin nombres y sin esa promesa.
6. **Lo que guarda el navegador es por persona** (`praxis.u.<id>.*`): los permisos de una no
   los hereda otra en el mismo teléfono.
7. **Al registrador viaja lo mínimo:** la frase, la hora, el agua de hoy y si la persona ve
   sus cifras. No el plan (lo lee el servidor con el JWT), ni el check-in, ni el usuario.

## Límites honestos

- **El filtro de riesgo es un diccionario.** No generaliza. Por eso Praxis sigue cerrada.
- **No se probó contra la Edge Function real**: no está desplegada. Las pruebas de pantalla
  usan dobles; las del cliente, `fetch` simulado. La primera prueba real es el paso 5 de
  `PASOS-DE-BRYAN.md`.
- **La migración 0105 no se ha corrido en producción.** Sí corre en el Postgres del CI.
- **Tras guardar, el almacén del teléfono no se entera** hasta la siguiente hidratación: lo
  que el servidor escribió no aparece en pantalla hasta recargar.
- **La pregunta de aclaración** se reenvía como la frase original más la opción elegida. El
  servidor no guarda el borrador entre turnos, así que puede volver a preguntar.

## Cambios tras la revisión independiente (1-oct, noche)

La revisión del PR #331 (`REVISION-PR-331.md`, fuera del repo) dio «fusionar con cambios».
Lo que cambió:

- **Un solo filtro de riesgo para la pantalla y la función** (`domain/praxis/riesgo.ts`; la
  función lo importa con rutas `.ts`). La excepción de exageración vale solo para una lista
  cerrada («me muero de sueño») y nunca con «por».
- **El contexto decide** (Bryan, en vivo): una fórmula de morir atada a lo pautado (rutina,
  ejercicio, dieta) y sin señal de literalidad lleva a la pregunta de cuidado; con «de
  verdad», «ya no», «la vida», un método, o sin ancla, a la Quieta. El humor no cuenta.
- **La función solo atiende al equipo** (mismo interruptor de `acceso.ts`): 403 antes del
  modelo para quien no lo es.
- **Sin modo estricto** en la herramienta: el esquema tiene 46 uniones y el modo estricto
  admite 16. La validación del servidor falla cerrando. Los errores de Anthropic van al log.
- **`hora_local`** solo se cree con la forma exacta y a menos de un día del servidor.
- **El tope de dos preguntas** pasa a un trigger con candado (probado en el CI con tres
  filas en una sentencia).
- **Escritura perdida**: no se arregla aquí (es la sincronización de toda la app); la
  pantalla avisa que hay que recargar antes de anotar más series de ese ejercicio.
- **`/praxis/ejemplo`** conserva la maqueta completa, con datos de ejemplo, para el equipo.
