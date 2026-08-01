-- ============ 0020: EL ESTADO DEL MICROCICLO LO DECIDE EL STAFF ============
-- Hallazgo de la revisión adversaria del mecanismo de activación (2026-08-01).
--
-- EL FALLO
-- La app hace UPSERT del microciclo entero cada vez que el asesorado registra una
-- serie, y ese payload incluye la columna `estado`. Si entrena sin señal, su cola
-- guarda un upsert con `estado: 'activo'`. Mientras tanto el coach cierra ese
-- microciclo y abre el siguiente. Cuando el móvil recupera cobertura, su cola
-- drena y REABRE el que ya estaba cerrado: el servidor queda con DOS activos.
--
-- Ese estado no es hipotético: ya pasó en producción con dos asesoradas, y cuando
-- pasa, `find(m => m.estado === 'activo')` devuelve uno cualquiera. La persona
-- puede abrir la app y encontrarse la semana pasada.
--
-- El cliente ya no manda `estado` al cambiarlo (ahora es un update de la columna,
-- ver `sync.ts`), pero eso no basta: una PWA cacheada sigue ejecutando la versión
-- vieja durante días. El candado tiene que estar en el servidor.
--
-- POR QUÉ NO LANZA EXCEPCIÓN (a diferencia de 0008)
-- Porque el upsert del asesorado lleva TAMBIÉN sus series dentro de `datos`.
-- Rechazar la escritura entera haría que la operación fallara, se reintentara
-- ocho veces y acabara descartada: perderíamos las series por proteger el estado.
-- Justo el daño que se quiere evitar. Así que el estado viejo se conserva en
-- silencio y el resto de la fila se guarda: el asesorado sube su trabajo, y no
-- decide en qué microciclo está.
--
-- Solo aplica a UPDATE. En INSERT el estado que venga es el bueno: la fila nace
-- del coach (`guardarPropuesta`) o es la primera subida de un microciclo que
-- todavía no existía en el servidor, y no hay ningún `old` que conservar.

create or replace function public.proteger_estado_microciclo()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.estado is distinct from old.estado then
    -- auth.uid() nulo = contexto de servicio/migración (sin sesión de usuario)
    if auth.uid() is not null and not public.es_staff() then
      new.estado := old.estado;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_estado_microciclo on public.microciclos;
create trigger trg_proteger_estado_microciclo
  before update on public.microciclos
  for each row execute function public.proteger_estado_microciclo();
