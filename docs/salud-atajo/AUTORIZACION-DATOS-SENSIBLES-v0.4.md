# Autorización para tratar datos sensibles (salud) — clientes de Alpha Athletics

**Versión:** 0.4 · **Fecha:** 28-sep-2026 (casilla E nueva: datos de salud que se leen del teléfono; la D sigue igual que en la 0.3) · **Estado:** PREPARADO (borrador). No habilita a operar:
lo decide Bryan cuando estén cerrados los `FALTA` y revisado por abogado (CONTRATOS-v2 §0, C3).

---

## Para Bryan: cómo se usa (no se le muestra al cliente)

1. **Momento:** se envía **antes** de hacer cualquier pregunta sobre salud, lesiones, medicación,
   medidas, fotos o alimentación. Las 3 preguntas de encaje del embudo **no preguntan nada de salud**.
   La autorización debe ser previa (Ley 1581 de 2012, art. 9) y, para datos sensibles, explícita
   (Ley 1581, art. 6 lit. a; Decreto 1377 de 2013, art. 6, compilado en el Decreto 1074 de 2015,
   art. 2.2.2.25.2.3).
2. **Forma:** formulario o mensaje con las casillas de la sección 10 **sin marcar de antemano**. El
   silencio no vale como autorización (Decreto 1377, art. 7 → DUR 1074, art. 2.2.2.25.2.4).
3. **Prueba:** se guarda el registro de la sección 11 (quién, qué casillas, versión, fecha, canal).
   El responsable debe poder demostrar que obtuvo la autorización (Ley 1581, art. 17 lit. b; Decreto
   1377, art. 8 → DUR 1074, art. 2.2.2.25.2.5).
4. **Si rechaza:** no se le hacen las preguntas de salud, no se guarda ningún dato sensible y se le
   ofrece lo de la sección 9 (prueba de C4: «rechaza el consentimiento»).
5. **Solo mayores de 18 años** (criterio propio: el tratamiento de datos de menores tiene reglas
   propias —Ley 1581, art. 7— y aquí no se ha preparado ese caso).
6. **La casilla E (nueva en la 0.4)** autoriza leer del teléfono seis datos (pasos, sueño, frecuencia
   cardiaca en reposo, variabilidad de la frecuencia cardiaca, minutos de ejercicio y peso). Va **sin
   marcar** y es **independiente** de A–D. Se puede marcar en el formulario de interesados, pero **ese
   «Sí» no activa nada**: quien todavía no tiene cuenta no tiene un teléfono que leer. La autorización
   que cuenta para leer datos es la que la persona da **dentro de la app, ya con su cuenta** (Bienestar →
   Salud de tu celular): queda como evento en `salud_consentimientos` (migración 0093), con la versión
   del texto y la fecha del servidor. Sin ese evento, el servidor rechaza cualquier envío del atajo.
7. **Revocar tiene que ser fácil** (Ley 1581, art. 8): la persona lo hace sola, en la misma tarjeta de
   la app. Al revocar se apaga el código del atajo al instante y, si lo pide, se borra lo ya enviado.

---

## Texto para el cliente

### 1. Quién trata tus datos (responsable)

- Nombre o razón social: `FALTA: razón social o nombre de la persona natural titular de Alpha Athletics`
- Identificación: `FALTA: NIT o cédula`
- Dirección: `FALTA: dirección física`
- Correo para temas de datos: `FALTA: correo dedicado a protección de datos`
- Teléfono / WhatsApp: `FALTA: número`
- Política de tratamiento completa: `FALTA: enlace a la política general de Alpha Athletics`

(Ley 1581, art. 12 lit. d; Decreto 1377, art. 15 → DUR 1074, art. 2.2.2.25.3.3.)

### 2. Qué datos tuyos son sensibles aquí

La ley llama **datos sensibles** a los que afectan tu intimidad o cuyo mal uso puede discriminarte;
entre ellos, los **relativos a la salud** (Ley 1581, art. 5). En tu coaching te podemos pedir:

| Dato | Ejemplo | ¿Por qué lo tratamos como sensible? |
|---|---|---|
| Lesiones y dolor | «me duele la rodilla al bajar escaleras» | dato de salud (art. 5) |
| Patologías y diagnósticos | hipertensión, diabetes, hipotiroidismo | dato de salud (art. 5) |
| Medicación y suplementos | qué tomas y en qué dosis | dato de salud (art. 5) |
| Alimentación | qué comes, alergias, intolerancias, horarios | revela salud y hábitos (criterio propio: se trata como sensible) |
| Medidas corporales | peso, perímetros, % de grasa | revela estado de salud (criterio propio: se trata como sensible) |
| Fotos corporales | frente, perfil y espalda para ver progreso | muestran tu cuerpo y estado físico (criterio propio: se tratan como sensibles; no se usan para identificarte biométricamente) |
| Datos de tu teléfono (solo si autorizas E) | pasos, sueño, frecuencia cardiaca en reposo, variabilidad de la frecuencia cardiaca, minutos de ejercicio y peso, un resumen por día | sueño, frecuencia cardiaca, variabilidad y peso son datos de salud (art. 5); los pasos y los minutos de ejercicio se tratan como sensibles por criterio propio |

### 3. No estás obligado/a a responder

**Responder sobre estos datos es voluntario (facultativo).** No estás obligado/a a autorizar su
tratamiento ni a contestar preguntas sobre ellos (Ley 1581, art. 12 lit. b; Decreto 1377, art. 6
num. 1). Puedes autorizar unas finalidades y otras no (sección 10) y cambiar de opinión después.

### 4. Para qué los usamos (finalidades concretas)

Solo para estas finalidades, cada una con su casilla (Ley 1581, art. 4 lit. b — principio de
finalidad):

- **A. Plan de entrenamiento seguro:** adaptar ejercicios, cargas y volumen a tus lesiones,
  patologías y medicación, y detectar cuándo conviene que consultes a un profesional de la salud.
- **B. Nutrición individualizada:** preparar una propuesta de alimentación adaptada a lo que ya
  comes, tu horario y tu presupuesto, que **revisa y aprueba un/a profesional en Nutrición y
  Dietética habilitado/a** antes de entregártela (Ley 73 de 1979, arts. 2, 5 y 9).
- **C. Seguimiento con fotos y medidas:** comparar tu progreso en el tiempo.
- **D. Procesamiento por proveedores tecnológicos, algunos fuera de Colombia** (sección 6, los
  marcados «requiere D»): preparan por encargo nuestro los borradores de tus planes y su
  seguimiento. Un humano los revisa antes de que te lleguen. D **no añade finalidades**: solo
  permite que los datos que ya autorizaste en A, B o C se procesen con esos proveedores. Los **planes y registros
  derivados** de tus datos de salud (p. ej. un plan adaptado a tu lesión) cuentan como datos de salud
  para esta casilla.

- **E. Datos de salud de tu teléfono:** leer desde tu teléfono (Apple Salud, con un atajo, o Health
  Connect, con la app de Alpha) tus pasos, sueño, frecuencia cardiaca en reposo, variabilidad de la
  frecuencia cardiaca, minutos de ejercicio y peso, para que Alpha y tu coach ajusten tus
  recomendaciones de estilo de vida y entrenamiento. **Solo guardamos un resumen por día** de esos
  seis datos: nunca tu ubicación, tus rutas ni las mediciones sueltas (Ley 1581, art. 4 lit. b —
  finalidad—; Decreto 1377, art. 4 → DUR 1074, art. 2.2.2.25.2.1 — recolectar solo lo pertinente). E **no** autoriza el procesamiento por proveedores tecnológicos fuera de Colombia:
  eso sigue dependiendo de la casilla D.

**Proveedores externos y equipos propios.** *Proveedor externo* = los de la sección 6 marcados
«requiere D»; solo con D. *Procesamiento en equipos propios* = herramientas que corren en equipos de
Alpha, sin enviar tus datos fuera. **En esta versión Alpha no procesa tus datos en equipos propios con
esas herramientas** (`FALTA: decisión de Bryan`). Si decide usarla, se
publicará una versión nueva de este texto antes, y solo servirá para las finalidades A, B o C que
hayas marcado (criterio propio).

**No los usamos para:** publicidad, venderlos, compartirlos con el creador de contenido que te
recomendó, ni publicar tus fotos. Para mostrar tu caso o tu testimonio se te pedirá una
autorización **aparte**, que no incluye datos de salud.

### 5. Quién los ve

- **Bryan** (coach y responsable del servicio).
- **El/la profesional en Nutrición y Dietética** que revisa tu plan, **solo si autorizas B**,
  obligado/a a confidencialidad. Ve tus fotos **solo si autorizas B y C**. Si no autorizas B, no ve
  ningún dato tuyo.
- **Los proveedores tecnológicos** que preparan los borradores (sección 6, «requiere D»), **solo si
  autorizas D**, y solo con los datos de las finalidades que marcaste. **Tus fotos no se les envían**
  en esta versión.
- **Los datos de tu teléfono (casilla E)** los ve **Bryan** y las personas de Alpha a quienes él ha
  dado acceso a la información de entrenamiento (hoy, **Manuela**, que también es la nutricionista), por
  una regla del sistema, aunque no hayas autorizado B. `FALTA: confirmación de Bryan y revisión de
  abogado: esto es una excepción a la regla anterior («si no autorizas B, no ve ningún dato tuyo»); si
  no se acepta, hay que quitar a la nutricionista de esa regla antes de usar E.`
- **El creador de contenido que te recomendó NUNCA ve tus datos de salud, fotos ni medidas.** Como
  mucho sabe que alguien se inscribió con su código, sin datos de salud (criterio propio; ver
  `MAPA-DE-DATOS.md`).

### 6. Proveedores que reciben tus datos (incluida transferencia internacional)

Para prestar el servicio usamos proveedores tecnológicos que guardan o procesan datos **por cuenta
nuestra**. Varios están **fuera de Colombia** (principalmente Estados Unidos). Enviar datos a otro
país es una transferencia o transmisión internacional (Ley 1581, art. 26; Decreto 1377, arts. 24 y
25 → DUR 1074, art. 2.2.2.25.5.1).

| Proveedor (previsto) | Qué hace | Qué recibe | País | ¿Requiere D? | Confirmado |
|---|---|---|---|---|---|
| Supabase | base de datos de la app, formulario de interesados, evidencia de tu autorización y hoja del piloto | tu ficha, planes, medidas, fotos si se suben a la app; los resúmenes diarios de tu teléfono si autorizas E; en la hoja, **sin datos de salud** | `FALTA: región del proyecto` | no | `FALTA` |
| Apple (tu iPhone y la app Salud) | de aquí salen los datos de E; el atajo los lee en tu teléfono y los manda a Alpha solo mientras tú lo tengas activo | nada de Alpha: Apple no recibe tus datos de Alpha; el envío va de tu teléfono a Supabase | (tu teléfono) | no | `FALTA` |
| Vercel | aloja la app web | datos que pasan por la app al usarla | EE. UU. | no | `FALTA` |
| Proveedores de procesamiento de planes (p. ej. Anthropic, OpenAI, Google) | preparan borradores del plan y su seguimiento, por encargo nuestro | datos de salud necesarios para el plan, sin tu nombre | EE. UU. | **sí** | `FALTA: lista exacta de proveedores y si hay intermediario (p. ej. OmniRouter)` |
| Meta (WhatsApp) | conversación contigo | lo que escribas o envíes por chat | EE. UU. / otros | no | `FALTA` |
| Mercado Pago | cobro y suscripción mensual | datos de pago (Alpha no guarda tu tarjeta) | `FALTA: país de procesamiento` | no | `FALTA` |

Medida que aplicamos (criterio propio): antes de enviar datos a los proveedores que requieren D quitamos tu nombre, documento
y teléfono y usamos un código interno; enviamos solo lo necesario para el plan (Ley 1581, art. 4
lit. g — seguridad; Decreto 1377, art. 4 → DUR 1074, art. 2.2.2.25.2.1 — recolectar solo lo
pertinente).

La casilla D cubre **solo a los proveedores marcados «requiere D»**. Los proveedores de
almacenamiento, comunicación y pago (Supabase, Vercel, Meta, Mercado Pago) actúan como encargados por cuenta de Alpha;
su transmisión internacional se apoya en un contrato de transmisión (Decreto 1377, arts. 24 y 25)
`FALTA: verificar el contrato de cada uno; sin verificarlo no se les envían datos de salud` (duda
para abogado).

Si **no** marcas la casilla D, tus datos de salud y los planes derivados de ellos **no se envían a
los proveedores que requieren D**; qué se puede ofrecerte en ese caso está en la sección 9. El detalle
por dato y por destino está en `MAPA-DE-DATOS.md`.

### 7. Cuánto tiempo los guardamos

Solo el tiempo razonable y necesario para la finalidad (Decreto 1377, art. 11 → DUR 1074,
art. 2.2.2.25.2.8). Plazos propuestos (criterio propio, a validar con abogado):

- Mientras seas cliente activo y hasta **6 meses** después de tu último pago, para poder retomar tu
  plan si vuelves. Después se **borran** los datos de salud, fotos y medidas.
- Si revocas la autorización: se borran en **máximo 15 días hábiles** (el plazo de un reclamo,
  Ley 1581, art. 15), salvo lo que una ley obligue a conservar.
- Los **datos de tu teléfono (E)** se guardan mientras tengas el permiso activo. Si lo revocas en la
  app, el código del atajo se apaga **al instante** y dejamos de leer y de usar esos datos. Lo ya enviado
  se borra **en el acto** si dejas marcado «Borrar también los datos que ya envié» (viene marcado); si lo
  desmarcas, no se usa pero queda guardado hasta que pidas borrarlo, y lo borramos en el plazo de arriba.
  `FALTA: decisión de Bryan: ¿se permite conservar lo enviado después de revocar, o revocar siempre
  borra? La app hoy deja elegir.`
- La **prueba de tu autorización** se conserva mientras existan los datos y el tiempo que haga falta
  para demostrarla ante la autoridad (Decreto 1377, art. 8).
- Si el/la nutricionista abre una **historia clínica**, esta se rige por las normas de historia
  clínica y la custodia él/ella (ver `ACUERDO-NUTRICION.md`, pendiente de abogado).

### 8. Tus derechos y cómo ejercerlos

Tienes derecho a (Ley 1581, art. 8):
- conocer, actualizar y corregir tus datos;
- pedir prueba de esta autorización;
- saber qué uso se les ha dado;
- revocar la autorización o pedir que se borren (salvo deber legal de conservarlos);
- acceder gratis a tus datos;
- quejarte ante la **Superintendencia de Industria y Comercio (SIC)**, después de habernos hecho
  la consulta o el reclamo (Ley 1581, art. 16).

**Cómo:** escribe a `FALTA: correo de datos` o `FALTA: WhatsApp` con tu nombre, qué pides y cómo
te contestamos.
- **Consultas** (qué datos tenemos, para qué): respuesta en máx. **10 días hábiles**, prorrogables
  5 más avisándote (Ley 1581, art. 14).
- **Reclamos** (corregir, borrar, revocar, incumplimiento): respuesta en máx. **15 días hábiles**,
  prorrogables 8 más avisándote (Ley 1581, art. 15).

### 9. Si no autorizas (o revocas después)

No pasa nada contra ti: **ninguna actividad se condiciona a que entregues datos sensibles**
(Decreto 1377, art. 6, inciso final). Lo que cambia es qué podemos hacer con seguridad:

- **Sin A:** podemos darte un plan de entrenamiento **general y conservador**, sin adaptarlo a
  lesiones o patologías, con la recomendación de que un profesional de la salud te valore si tienes
  alguna condición.
- **Sin B:** **no** te entregamos un plan de nutrición individualizado. Sí podemos darte pautas
  **generales** de alimentación (no ajustadas a tu salud) y sugerirte consultar a un profesional en
  Nutrición y Dietética.
- **Sin C:** el **seguimiento de progreso** se hace con tus sensaciones, tu rendimiento y los datos
  que quieras darnos, sin fotos ni medidas de progreso. Si marcaste B, sí usamos las **medidas
  necesarias para tu plan de nutrición** (peso, talla y las que pida el profesional), solo para esa
  finalidad; nunca fotos.
- **Sin D:** tus datos de salud y los planes derivados no pasan por los proveedores que requieren D.
  Recibes **el mismo servicio**, preparado sin esos proveedores, al mismo precio (Bryan, 27-sep).

- **Sin E:** no leemos nada de tu teléfono. Recibes **el mismo servicio**: tu coach ajusta tu plan con
  lo que anotes a mano en el check-in (pasos, sueño, peso). En Android, así funciona siempre: el atajo
  solo existe para iPhone.

Si revocas cuando ya tienes plan, dejamos de usar esos datos para lo revocado y se aplica lo de
arriba desde ese momento.

### 10. Tu decisión (una casilla por finalidad)

Marca **Sí** o **No** en cada una. Nada viene marcado.

| | Finalidad | Sí | No |
|---|---|---|---|
| A | Usar mis **lesiones, patologías y medicación** para adaptar mi plan de entrenamiento | ☐ | ☐ |
| B | Usar mi **alimentación, medidas y datos de salud** para preparar un plan de nutrición individualizado revisado por un/a nutricionista habilitado/a | ☐ | ☐ |
| C | Tratar mis **fotos corporales y medidas** para seguir mi progreso (si también marco B, el/la nutricionista puede verlas) | ☐ | ☐ |
| D | «Para preparar y hacer seguimiento a tu plan usamos proveedores tecnológicos que procesan tus datos por encargo nuestro; algunos tienen sus servidores fuera de Colombia. ¿Lo autorizas?» | ☐ | ☐ |
| E | «Leer desde mi teléfono (Apple Salud, con un atajo, o Health Connect, con la app de Alpha) mis pasos, mi sueño, mi frecuencia cardiaca en reposo, mi variabilidad de la frecuencia cardiaca, mis minutos de ejercicio y mi peso, para que Alpha y mi coach ajusten mis recomendaciones de estilo de vida y entrenamiento» | ☐ | ☐ |

Alcance de la casilla D (se muestra junto a ella): son los proveedores de la sección 6 marcados
«requiere D»; solo reciben, **sin tu nombre**, los datos de las finalidades que marcaste y los planes
derivados, nunca fotos; marcar «Sí» es tu autorización expresa para esa transferencia fuera de
Colombia (Ley 1581, art. 26 lit. a). Si marcas «No», recibes el mismo servicio sin esos proveedores.

Alcance de la casilla E (se muestra junto a ella): solo guardamos un resumen por día de esos seis datos:
nunca tu ubicación, tus rutas ni las mediciones sueltas. Lo ven tu coach y el equipo de Alpha con acceso
a entrenamiento. Es voluntario: si marcas «No», recibes el mismo servicio y anotas tu check-in a mano.
Puedes revocarla cuando quieras, en la app (Bienestar, Salud del celular): tu código deja de funcionar al
instante y, si lo pides, borramos lo que ya enviaste. Los proveedores tecnológicos solo reciben estos
datos si además marcas la D.

Declaro que: me informaron que responder sobre datos sensibles es voluntario; que leí para qué se
usan, quién los ve, a qué proveedores y países van, cuánto tiempo se guardan y cómo ejercer mis
derechos; y que soy mayor de 18 años.

- Nombre: ______________________ · Documento: ______________ (opcional si no hace falta para
  facturar — criterio propio de minimización)
- Fecha: ____ / ____ / ______ · Canal: ☐ formulario ☐ WhatsApp ☐ firma en papel ☐ app
- Versión del texto aceptado: **0.4 (28-sep-2026)**

---

## 11. Registro de la prueba (lo llena Alpha; no se muestra al cliente)

| Campo | Ejemplo |
|---|---|
| `cliente_id` | identificador interno (CONTRATOS-v2 §1) |
| `version_autorizacion` | 0.4 |
| `fecha_hora` | 2026-10-05 14:32 (hora de Colombia) |
| `canal` | formulario / WhatsApp / papel / app |
| `A`, `B`, `C`, `D`, `E` | sí / no por separado |
| `evidencia` | registro del formulario de la web de Alpha, guardado en Supabase (Bryan, 27-sep; el espacio está **pendiente de construir** en alpha-app) |
| `revocaciones` | fecha y finalidad revocada, si las hay |
| `E` dentro de la app | el permiso E de una persona con cuenta se registra como eventos `otorgada` / `revocada` en `salud_consentimientos` (migración 0093): versión del texto, fecha y hora del servidor, declaración aceptada. Solo se añade; la revocación no borra la prueba. |

Sin una fila completa aquí, **no** se hacen preguntas de salud a esa persona.

---

## Cambios de la 0.3 a la 0.4 (28-sep-2026)

- **Casilla E nueva**: leer del teléfono seis datos (pasos, sueño, FC en reposo, VFC, minutos de ejercicio
  y peso). Sin marcar, independiente de A–D, revocable dentro de la app. Cambios: «Para Bryan»
  (puntos 6 y 7), §2 (fila nueva), §4 (finalidad E), §5 (quién ve E, con un `FALTA`), §6 (Apple y la fila de
  Supabase), §7 (conservación de E), §9 (sin E), §10 (casilla E, su alcance y el canal «app») y §11.
- **Sin cambios**: A, B, C y D (la D conserva la redacción neutra de Bryan de la 0.3, al pie de la letra).
- La versión aceptada pasa a **0.4**: la base rechaza una autorización de un texto que no sea el vigente
  (con la excepción del formulario público, que sigue aceptando la 0.3 solo con la E en «no»).

## Normas citadas

- Ley 1581 de 2012: arts. 4, 5, 6, 7, 8, 9, 12, 14, 15, 16, 17, 26.
- Decreto 1377 de 2013 (compilado en el Decreto Único 1074 de 2015, Libro 2, Parte 2, Título 2,
  Capítulo 25): arts. 4, 6, 7, 8, 11, 15, 24, 25.
- Ley 73 de 1979: arts. 2, 5 y 9 (ejercicio de la Nutrición y Dietética).
- Consultadas el 26-sep-2026 en el normograma de Cancillería (Ley 1581), el de MinTIC (Decreto
  1377) y el PDF de Minsalud (Ley 73).

**Borrador: revisar con abogado antes de usar.**
