-- Migration: Add ON DELETE CASCADE to event references
-- This ensures that when an event is deleted, all related data is also automatically deleted.

-- 1. Notificaciones
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'notificaciones_event_id_fkey' AND table_name = 'notificaciones') THEN
        ALTER TABLE notificaciones DROP CONSTRAINT notificaciones_event_id_fkey;
    END IF;
END $$;

ALTER TABLE notificaciones
ADD CONSTRAINT notificaciones_event_id_fkey
FOREIGN KEY (event_id)
REFERENCES eventos(id)
ON DELETE CASCADE;

-- 2. Asistencias
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'asistencias_event_id_fkey' AND table_name = 'asistencias') THEN
        ALTER TABLE asistencias DROP CONSTRAINT asistencias_event_id_fkey;
    END IF;
END $$;

ALTER TABLE asistencias
ADD CONSTRAINT asistencias_event_id_fkey
FOREIGN KEY (event_id)
REFERENCES eventos(id)
ON DELETE CASCADE;

-- 3. Relay Points (Puntos de Relevo)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'relay_points_event_id_fkey' AND table_name = 'relay_points') THEN
        ALTER TABLE relay_points DROP CONSTRAINT relay_points_event_id_fkey;
    END IF;
END $$;

ALTER TABLE relay_points
ADD CONSTRAINT relay_points_event_id_fkey
FOREIGN KEY (event_id)
REFERENCES eventos(id)
ON DELETE CASCADE;

-- 4. Relevos (Relays themselves)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'relevos_event_id_fkey' AND table_name = 'relevos') THEN
        ALTER TABLE relevos DROP CONSTRAINT relevos_event_id_fkey;
    END IF;
END $$;

ALTER TABLE relevos
ADD CONSTRAINT relevos_event_id_fkey
FOREIGN KEY (event_id)
REFERENCES eventos(id)
ON DELETE CASCADE;
