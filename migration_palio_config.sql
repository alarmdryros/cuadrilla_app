-- Tabla para configuración del Palio (diferencias de altura por trabajadera y año)
create table public.palio_config (
  id uuid default gen_random_uuid() primary key,
  anio integer not null,
  trabajadera integer not null,
  diferencia_cm float not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Restricción única: Una trabajadera solo tiene una configuración por año
  unique(anio, trabajadera)
);

-- Políticas RLS (Row Level Security) básicas
alter table public.palio_config enable row level security;

-- Permitir lectura a usuarios autenticados
create policy "Usuarios autenticados pueden ver config palio"
on public.palio_config for select
to authenticated
using (true);

-- Permitir inserción/actualización solo a roles de gestión (ajustar según necesidad, aquí genérico a auth)
-- Idealmente restringir a admin/capataz en el futuro si se requiere estricto
create policy "Usuarios autenticados pueden insertar/actualizar config palio"
on public.palio_config for insert
to authenticated
with check (true);

create policy "Usuarios autenticados pueden actualizar config palio"
on public.palio_config for update
to authenticated
using (true);
