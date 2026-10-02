# Praxis conectada: lo que te toca a ti

Rama `feat/praxis-conexion`, PR #331 (1-oct-2026). El PR está **sin fusionar**. Ya pusiste el
secreto; la migración y la función siguen sin aplicar ni desplegar.

Piensa en una caja registradora nueva: el mostrador ya está puesto y cableado (la
pantalla) y la llave ya está en tu bolsillo (el secreto). Falta darle corriente a la caja
(la función) y atornillar el buzón de sugerencias a la pared (la tabla de preguntas). Los
pasos de abajo son enchufar cada cosa, en orden, y comprobar que encendió antes de pasar a
la siguiente.

## Qué pasa si no haces nada

Si solo fusionas el PR, la pantalla `/praxis` sigue siendo **solo para el equipo** y:

- enseña tus datos reales (tu plan aprobado, tus check-ins de 14 días) en vez de los de ejemplo;
- contesta preguntas de tu plan sin modelo («¿qué me toca hoy?»);
- se detiene ante una frase de riesgo y enseña la Quieta con el 123, el 106, el 155 y el 141;
- cuando le escribes algo para anotar, dice **«mi registrador todavía no está encendido»**;
- cuando aceptas «¿Se lo pregunto a tu coach?», dice **«no la mandé»**.

No finge nada. Para los asesorados no cambia nada: no ven la pantalla.

La maqueta completa (el check-in guiado de cuatro turnos, el pentagrama, la firma del día)
sigue en **`/praxis/ejemplo`**, solo para el equipo y con su sello de «Datos de ejemplo».

## Los pasos, en orden

### 1. Aplicar la migración 0105 (la bandeja de «pregunta en espera»)

- **Archivo:** `supabase/migrations/0105_praxis_preguntas_en_espera.sql`.
- **Antes:** corre `supabase/comprobar-migraciones.sql` en el SQL Editor. Las **seis** filas
  que empiezan por `0105 - …` tienen que decir **NO**. Si alguna dice SI, para y avísame.
- **Aplicar:** pega el archivo entero en Supabase → SQL Editor → Run. Compara la última
  línea del editor con la última del archivo (`commit;`): un pegado cortado no da error.
- **Después:** vuelve a correr `comprobar-migraciones.sql`. Las seis filas `0105 - …` tienen
  que decir **SI**.
- **Ojo con el número:** hay otras ramas sin fusionar con las migraciones 0090 a 0104. La
  0105 no depende de ninguna (solo usa `usuarios_app`, `es_coach()` y `es_nutricionista()`,
  que ya están en producción). Si antes de aplicarla otra rama coge el 0105, se renumera
  esta **antes** de aplicar.
- **No crea datos de nadie** y no toca ninguna tabla existente. El tope de dos preguntas
  abiertas por persona vive en un trigger con candado: probado en el CI contra Postgres,
  también con tres filas en una sola petición.

### 2. El secreto `ANTHROPIC_API_KEY`: ya está

Lo pusiste el 1-oct: `supabase secrets list` muestra `ANTHROPIC_API_KEY`, actualizado a las
21:03 (UTC). No hay que hacer nada más aquí. Cada mensaje que llegue al modelo se paga por
uso a Anthropic (el diseño estima unos 0,0026 USD por mensaje); por eso la función solo
atiende al equipo mientras Praxis esté cerrada (ver el paso 3).

### 3. Desplegar la Edge Function `praxis-registro` y hacer UNA petición de prueba

- **Desde dónde:** el código está en esta rama. En tu terminal:
  `cd F:/wt/praxis-conexion` y luego `supabase functions deploy praxis-registro`.
- **Con la CLI, no pegando el archivo en el panel:** la función importa el dominio con rutas
  relativas (`../../../src/domain/praxis/...`) y el panel no las resuelve.
- **Nunca con `--no-verify-jwt`.** Deja Verify JWT encendido (es el valor por defecto). La
  función además valida el token ella misma, saca de ahí quién es la persona y le pregunta
  su rol: a quien no es del equipo le responde **403** antes de llamar al modelo.
- **Riesgo que no pude descartar:** nadie ha probado que la CLI empaquete esas rutas
  relativas. Si el despliegue falla diciendo que no encuentra un módulo, no lo fuerces:
  avísame y lo arreglo.
- **Comprobar que quedó desplegada** (sin sesión, desde tu terminal):
  `curl -i -X POST https://<tu-proyecto>.supabase.co/functions/v1/praxis-registro -H "content-type: application/json" -d "{}"`
  - **401** → está desplegada (te pide sesión, que es lo correcto);
  - **404** → no está desplegada.
- **Una sola petición de prueba con TU sesión, y mirar el log.** Es la primera vez que la
  función habla con Anthropic de verdad: ninguna prueba lo ha hecho.
  - La forma fácil es después del paso 4: abre `/praxis`, acepta la bienvenida y escribe
    **una** frase normal, por ejemplo `seguí el plan hoy`.
  - Si la quieres antes de fusionar, con `curl` y el `access_token` de tu sesión (en el
    navegador con la app abierta: DevTools → Application → Local Storage → la clave
    `sb-…-auth-token` → `access_token`; es tuyo, no lo pegues en ningún chat):
    `curl -i -X POST https://<tu-proyecto>.supabase.co/functions/v1/praxis-registro -H "authorization: Bearer <access_token>" -H "content-type: application/json" -d "{\"frase\":\"seguí el plan hoy\"}"`
  - **Mira el log:** panel de Supabase → Edge Functions → `praxis-registro` → Logs (o
    `supabase functions logs praxis-registro`).

  | Ves | Quiere decir |
  |---|---|
  | **200** con una `propuesta` y una `tarjeta`, y el log sin errores | Funciona. Sigue al paso 4 o al 5. |
  | **403** | Tu fila de `usuarios_app` no tiene rol `coach` ni `nutricionista`. |
  | **502** y en el log `praxis-registro: Anthropic respondió <código> <cuerpo>` | Anthropic rechazó la petición. El código y el cuerpo dicen por qué (la frase de la persona no se escribe en el log). Mándamelos. |
  | **502** y en el log `falta el secreto ANTHROPIC_API_KEY` | La función no ve el secreto. Vuelve a desplegarla después de `supabase secrets list`. |
  | **502** y en el log `la llamada a Anthropic falló TimeoutError` | Anthropic tardó más de 8 s. Prueba otra vez una sola vez; si se repite, avísame. |

### 4. Fusionar el PR

Fusionar a `main` publica en producción (Vercel). Antes, mira que el CI del PR esté en
verde, incluido el trabajo `base-de-datos`: ahí la 0105 se aplica sobre un Postgres de
verdad y corre `supabase/test/105-praxis-preguntas-en-espera.sql`.

Hay una prueba del encoder (`nucleoContraSusPruebas`) que está al filo de su límite de
120 s en el CI y a veces se pasa por segundos. No tiene que ver con Praxis: **si
`verificar` sale rojo solo por esa prueba, se relanza.**

### 5. Probar en `/praxis` con tu sesión

En el panel del coach, enlace **«Praxis (solo equipo)»**. Acepta la bienvenida y escribe:

| Escribe | Tiene que pasar |
|---|---|
| `¿qué me toca hoy?` | Contesta de tu plan, o dice «Aún no tengo ese dato: no veo un plan activo tuyo». Si tu cuenta de coach no tiene plan ni check-ins propios, verás todo vacío: para ver datos, pruébalo con la sesión de Manuela. |
| `seguí el plan hoy` | Sale una tarjeta «Lo que entendí» con **Guardar** y **Descartar**. Nada se guarda hasta que tocas Guardar. |
| toca **Guardar** | Dice «Listo, guardado» y una línea por registro. Compruébalo en la base: Table Editor → `adherencias`, tu fila de hoy. En la app no aparece hasta recargar. |
| `dormí seis horas` y Guardar | Dice que el check-in **todavía no se puede guardar desde Praxis**. Es correcto (ver «Qué no quedó conectado»). |
| `¿por qué esta semana es tan dura?` | «…no lo tengo escrito. ¿Se lo pregunto a tu coach? Te aviso cuando responda.» Con «Sí», dice que dejó la pregunta. Compruébalo: Table Editor → `praxis_preguntas_en_espera` tiene una fila `abierta`. |
| `me duele la rodilla` | No anota nada ni llama al modelo. Dice que es de salud y da el 123. |
| `me quiero morir con esta rutina de pierna` | Pregunta «¿Estás pensando en hacerte daño?» (está atado al entreno). Con «No», sigue. |
| `no aguanto más` | La misma pregunta. Con «Sí», la Quieta. |

**Con la sesión de Manuela, dos cuidados:**

- **No pruebes una frase de riesgo de verdad sin avisarle:** la Quieta deja Praxis detenida
  hasta el día siguiente (hay un botón «Reabrir Praxis (solo el equipo)» en la portada).
- **Si guarda una serie por Praxis, que recargue la app antes de anotar otra serie de ese
  mismo ejercicio en la pantalla de la sesión.** La app sube su copia de las series de un
  ejercicio entera y todavía no sabe de la que guardó Praxis: sin recargar, la pisaría. La
  pantalla de Praxis lo avisa al guardar. Arreglarlo de raíz es tocar la sincronización de
  toda la app, y no lo hice aquí.

### 6. Cómo responder una pregunta en espera (hoy, a mano)

La bandeja en la consola no está construida. Mientras tanto, en el SQL Editor:

```sql
update public.praxis_preguntas_en_espera
   set estado = 'respondida',
       respuesta = 'Tu respuesta aquí',
       respondida_por = '<tu id en usuarios_app>',
       respondida_en = now()
 where id = '<id de la pregunta>';
```

Las cuatro columnas van juntas: la tabla rechaza una respuesta a medias. La persona la ve
la próxima vez que abre la sala de Praxis («Respondió tu coach»).

## Lo que tienes que firmar antes de abrirla a asesorados

El interruptor (`PRAXIS_ABIERTA_A_ASESORADOS` en `src/domain/praxis/acceso.ts`) sigue en
`false` y este PR no lo toca. El mismo interruptor cierra ahora la pantalla **y** la
función. Antes de encenderlo falta, y nada de esto lo puedo decidir yo:

1. **El filtro de riesgo es solo el diccionario.** Firmaste diccionario + modelo en cada
   mensaje. El diccionario solo alcanzó 47 % en las frases reservadas del 29-sep. Las
   frases que se le sumaron el 1-oct (las de la revisión y las del contexto del entreno)
   son de **desarrollo**: que pasen no mide cuánto generaliza.
2. **Ante un riesgo, hoy nadie recibe aviso.** La pantalla lo dice tal cual («desde aquí
   todavía no se le avisa a nadie»). Hay que decidir por dónde llega el aviso y a quién
   (G4: a Manuela si el señalado es del equipo).
3. **Profesional de salud mental:** revisa los textos de la Quieta, las 48 fichas y la regla
   del contexto («me quiero morir con esta rutina» pregunta en vez de detenerse). Mientras
   tanto solo se usa la Quieta que ya existía; las fichas no se usan.
4. **Abogado (P8):** lo que se escribe para anotar viaja a Anthropic; hace falta el
   consentimiento y la revisión de la Ley 1581.
5. **Quitar el botón «Reabrir Praxis (solo el equipo)»**: existe solo para que el equipo
   pueda seguir probando después de una Quieta.
6. **Una bandeja de preguntas en la consola:** hoy la pantalla promete «te aviso cuando
   responda» y la respuesta se escribe a mano (paso 6). Una pregunta con riesgo que el
   diccionario no vea acabaría en esa bandeja que nadie mira.
7. **La regla P-2 (máximo 3 PR esperando tu revisión):** este es el PR número 12 abierto.
   Lo abrí porque lo pediste el 1-oct; si prefieres, lo paso a borrador o cierro otros.

## Qué no quedó conectado (y por qué)

| Qué | Por qué | Qué lo desbloquea |
|---|---|---|
| El check-in guiado de cuatro turnos en `/praxis` (sí está en `/praxis/ejemplo`, con datos de ejemplo) | El registrador no puede escribir un check-in a medias: una fila parcial cierra el formulario y da XP | Prerrequisito P2 del diseño del registrador |
| Guardar agua, comida, cardio y preparación desde Praxis | Faltan el libro de tarjetas (P5), el catálogo curado (P6) y la sincronización del cardio (P7) | P5, P6, P7 |
| Que la app sepa al momento lo que Praxis guardó | La app solo se entera al recargar; mientras tanto puede pisar una serie (ver el paso 5) | Tocar la sincronización de la app |
| El «porqué» de cada cambio del plan | La hoja del porqué (D2) no existe: la cadena no la escribe todavía | Cambio en el paso ③ de la cadena |
| El plan estratégico, los mensajes del coach, la revisión semanal y las fichas | No están en el almacén del teléfono de la persona; habría que leerlos aparte | Una lectura nueva con su JWT |
| La bandeja de preguntas en la consola y el aviso al llegar la respuesta | No se construyó; hoy se responde a mano (paso 6) | Trabajo aparte en la consola |
| La voz por micrófono | La maqueta la simulaba; aquí se quitó | El piloto de voz |
| El aviso al coach ante un riesgo | No existe ningún canal para eso | Tu decisión del punto 2 de arriba |
