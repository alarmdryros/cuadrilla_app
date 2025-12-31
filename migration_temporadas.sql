-- 1. Tabla de configuración para el año activo
CREATE TABLE IF NOT EXISTS configuracion (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Insertamos el año 2024 como año de inicio por defecto
INSERT INTO configuracion (key, value) 
VALUES ('año_actual', '2024') 
ON CONFLICT (key) DO NOTHING;

-- 2. Añadir columna "año" a las tablas principales
-- Usamos 2024 como valor por defecto para los datos existentes
ALTER TABLE costaleros ADD COLUMN IF NOT EXISTS año INTEGER DEFAULT 2024;
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS año INTEGER DEFAULT 2024;
ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS año INTEGER DEFAULT 2024;

-- 3. Asegurar que los datos antiguos tengan asignado el año 2024
UPDATE costaleros SET año = 2024 WHERE año IS NULL;
UPDATE eventos SET año = 2024 WHERE año IS NULL;
UPDATE asistencias SET año = 2024 WHERE año IS NULL;

-- 4. (Opcional) Hacer que el campo año sea obligatorio en el futuro
-- ALTER TABLE costaleros ALTER COLUMN año SET NOT NULL;
-- ALTER TABLE eventos ALTER COLUMN año SET NOT NULL;
-- ALTER TABLE asistencias ALTER COLUMN año SET NOT NULL;

-- NOTA: Si después de ejecutar esto ves errores de RLS (permisos), 
-- recuerda revisar que las políticas de seguridad permitan leer/escribir 
-- en la tabla "configuracion".
