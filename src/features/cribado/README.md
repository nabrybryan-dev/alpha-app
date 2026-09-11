# El cribado de salud · lo que la capa de datos deja cerrado y lo que no

Migración `0058`. Esta carpeta es de INTERFAZ (`CribadoForm.tsx`, `necesitaCribado.ts`);
este archivo lo escribe SERVIDOR Y DATOS para que quien monte la pantalla sepa **qué le
garantiza la capa de abajo y qué no**.

## Lo que la capa de datos garantiza

- **La tabla no admite un cribado a medias con `fuente='app'`.** El CHECK
  `cribado_de_la_app_esta_completo` exige las doce respuestas. Comprobado con un insert
  incompleto: rechazado.
- **`ausente` no es nulo.** `ausente` = «se preguntó y no tiene»; nulo = «no se preguntó».
  Ni la hidratación ni la subida rellenan un nulo con un valor por defecto.
- **El asesorado no puede reescribir su cribado.** La única política de UPDATE es del
  coach. Comprobado: cero políticas de UPDATE mencionan `auth.uid()`.
- **Contestar dos veces no rompe nada ni pisa nada.** `contestar_cribado()` hace
  `on conflict do nothing`, así que el segundo envío termina bien en vez de dar 42501,
  reintentarse ocho veces y descartarse en silencio.
- **Un cambio solo de cribado se propaga.** La tabla está en `firma_de_sincronizacion()`
  y tiene `trg_actualizado_en`, así que el teléfono se entera aunque no se mueva nada más.
- **Una respuesta sin señal no se pierde al hidratar.** `conCribadosSinSubir` conserva la
  local mientras el servidor no tenga fila para esa persona.

## Lo que INTERFAZ TIENE que hacer, y no es opcional

**`contestar()` devuelve `'guardado' | 'ya_estaba'`, y `'ya_estaba'` hay que enseñarlo.**

Pasa de verdad: el coach vuelca el expediente de esa persona mientras ella tiene la app
abierta, ella rellena el formulario, y su respuesta no entra porque ya había una. Si la
pantalla trata ese caso como éxito, se va creyendo que contestó.

Lo que tiene que ver, con estas palabras o parecidas: **«Esto ya estaba contestado. Tu
coach tiene tus respuestas.»** — y no volver a pedírselo.

## Lo que NO está cerrado, y de quién es

**El síntoma nuevo no tiene por dónde entrar.** Alguien contesta el lunes, le cargan el
plan, y el jueves nota dolor torácico al subir escaleras. Hoy no hay dónde decirlo: el
formulario ya no se le muestra, y si volviera a enviarlo recibiría `'ya_estaba'`.

Que el asesorado no reescriba su propia puerta clínica **es correcto** y no se cambia. Lo
que falta no es el permiso: es el camino. Hoy «se lo dice al coach» significa escribirle
por el chat y confiar en que lo lea, y nada en la app se lo sugiere.

Y hay un agravante: **nada conecta un cambio de cribado con el microciclo ya cargado**. No
existe señal de «este plan se decidió con un cribado que ya no es el vigente». La consulta
que hoy nadie mira:

```sql
select c.usuario_id, c.actualizado_en, m.datos->>'numero'
  from cribado c join microciclos m on m.usuario_id = c.usuario_id
 where m.estado = 'activo' and c.actualizado_en > m.creado_en;
```

**Es decisión de Bryan antes que código:** qué pasa con el microciclo vivo cuando el
cribado cambia a peor — ¿se para, se marca para revisión, se avisa al coach y ya? Con la
regla decidida, lo mínimo en la app es un camino explícito («algo ha cambiado en mi
salud») que mande un mensaje al coach y deje marca; y en la base, esa consulta dentro del
barrido posterior a cada carga.

Está levantado como riesgo 3 (CRÍTICO) en
`docs/riesgos/RIESGOS-preguntas-y-cribado.md`, con el resto de riesgos que esta capa no
cierra —entre ellos el 4: una fila `fuente='wiki'` admite las doce en nulo, así que media
ficha puede leerse como ficha—.
