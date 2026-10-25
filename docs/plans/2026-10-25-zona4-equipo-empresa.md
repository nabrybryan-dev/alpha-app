# Plan · zona 4 (Equipo y Empresa), 25-oct-2026

1. **Pruebas primero (en rojo)**: sombreros, filtro compartido, alarmas de dolor, chips,
   Bandeja, Empresa, cartera/ficha única, Hoy del equipo, interruptor de la vista simple.
2. **Dominio**: `src/domain/equipo/sombreros.ts` y `seguridad.ts` (puros, con sus tests).
3. **Filtro compartido**: `features/equipo/filtroSombreros.ts` + `Sombreros.tsx`.
4. **Seguridad**: `AvisosDeSeguridad.tsx` (fuera de los filtros).
5. **Bandeja** (`/bandeja`): Tareas · Mensajes · Firmas, componiendo lo existente.
6. **Empresa** (`/empresa`): grupos Entrenador · Nutrición · Administración + hoja de sombreros.
7. **Equipo**: una cartera y una ficha; mudanza de salud de datos, embudo y microciclos; enlaces
   a `/equipo/:id`; chips con cifras reales.
8. **Hoy del equipo**: banda de trabajo para el staff (rol nutricionista incluido) sin perder su
   día de asesorado; seguridad primero.
9. **«Vista de la app»**: interruptor con el mismo dato.
10. **Puertas y barra**: `SoloEquipo`; encoder y `/marca` solo equipo; `/coach/asesorados`
    redirige; retirar `AsesoradosPage`; barra del staff Hoy · Equipo · Bandeja · Empresa · Yo.
11. **Cierre**: `tsc -b` en 0, lint sin errores nuevos, suite completa, build; commits pequeños,
    push y PR en borrador con lo conservado y lo no comprobado.

## Riesgos conocidos

- `rutas.acceso.test` monta el router real con 7 perfiles: cualquier puerta nueva tiene que
  coincidir con `rutas.ts`, o el test lo dice.
- La consola de siete pestañas no se toca; el enlace directo baja a Empresa › Entrenador.
- Los enlaces `/coach/asesorado/:id` ya enviados siguen abriendo la ficha (no se borra la ruta).
