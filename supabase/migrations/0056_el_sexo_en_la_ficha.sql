-- 0056 · El sexo en la ficha
--
-- Bryan decidió (2026-09-06) que la ficha de cada asesorado lleve un campo `sexo`
-- que rellena el coach, y que con él el sujeto 3D del salón y del estudio del
-- cuerpo se dibuje con los huesos de un hombre o de una mujer sin que nadie
-- toque nada (`src/domain/patrones/juegoDeHuesos.ts`). Hasta hoy la app no lo
-- guardaba en ningún sitio. Ver `docs/specs/2026-09-06-el-sexo-en-la-ficha.md`.
--
-- UNA COLUMNA, NO UNA CLAVE DEL BLOB. `perfiles.datos` es JSONB y admitiría
-- `{"sexo": ...}` sin migración, pero:
--   · queda consultable en SQL sin abrir el blob;
--   · el `check` fija el vocabulario en la base: 'hombre' o 'mujer', nada más
--     —ni la 'M' ni la 'H' de la encuesta de nutrición, que es otra cosa—;
--   · y no la puede pisar el blob viejo de un móvil que hidrató antes de que el
--     coach la rellenara: la app manda el blob SIN esta clave, y un upsert que
--     no nombra la columna la deja como está.
--
-- SIN DATO NO CAMBIA NADA: `null` es «sin indicar» y el sujeto sigue neutro.
--
-- RLS: NO SE TOCA. `perfiles` la tiene desde la 0001; las políticas de escritura
-- son del coach (0046) más la propia fila del asesorado (0007), y una columna
-- nueva hereda las políticas de su tabla.
--
-- EL TRIGGER SÍ SE AMPLÍA. `proteger_perfil` (0008) deja al asesorado tocar solo
-- sus medidas, pero compara `datos` y solo `datos`: una columna fuera del blob se
-- le escapaba, y el asesorado habría podido escribirla por la API con su propia
-- sesión. La regla es la misma —el sexo lo indica el coach— y va en el mismo
-- sitio. El trigger `trg_proteger_perfil` ya existe y apunta a esta función;
-- basta con reemplazar el cuerpo.
--
-- ORDEN DE DESPLIEGUE: ESTA MIGRACIÓN VA ANTES QUE EL CÓDIGO. La app pide
-- `select datos,sexo`; si la columna no existe, la hidratación se traga el error
-- y todo el mundo se queda con lo local sin sincronizar.

begin;

alter table public.perfiles
  add column if not exists sexo text
  constraint perfiles_sexo_check check (sexo in ('hombre', 'mujer'));

comment on column public.perfiles.sexo is
  'Lo indica el coach en la ficha. Decide con qué huesos se dibuja el sujeto 3D. null = sin indicar (neutro).';

create or replace function public.proteger_perfil()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- auth.uid() nulo = contexto de servicio/migración (sin sesión de usuario)
  if auth.uid() is null or public.es_coach() then
    return new;
  end if;
  -- El resto del JSON (todo menos 'medidas') debe quedar idéntico. (0008)
  if tg_op = 'UPDATE'
     and (new.datos - 'medidas') is distinct from (old.datos - 'medidas') then
    raise exception 'Solo puedes actualizar tus medidas';
  end if;
  if tg_op = 'INSERT' and (new.datos - 'medidas') <> '{}'::jsonb then
    raise exception 'Solo puedes registrar tus medidas';
  end if;
  -- El sexo lo indica el coach. Vive fuera del blob, así que se mira aparte. (0056)
  if tg_op = 'UPDATE' and new.sexo is distinct from old.sexo then
    raise exception 'Solo el coach puede indicar el sexo';
  end if;
  if tg_op = 'INSERT' and new.sexo is not null then
    raise exception 'Solo el coach puede indicar el sexo';
  end if;
  return new;
end;
$$;

commit;

-- Señal: `0056 - el sexo en la ficha` en supabase/comprobar-migraciones.sql
