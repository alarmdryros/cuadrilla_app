-- Hacer el email opcional en la tabla de costaleros
ALTER TABLE costaleros 
ALTER COLUMN email DROP NOT NULL;
