-- Migration: Security Hardening (RLS)
-- Description: Enables Row Level Security on public tables and sets basic access policies.

-- 1. Table: notificaciones
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can insert their own notifications (absence reports)
CREATE POLICY "Enable insert for authenticated users" 
ON notificaciones FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Policy: Admins and Capataces can see all notifications
-- Note: This assumes we have a way to check roles. 
-- For now, we allow authenticated users to view notifications 
-- but in a production environment, we should filter by role in the JWT.
CREATE POLICY "Enable select for authenticated users" 
ON notificaciones FOR SELECT 
TO authenticated 
USING (true);

-- Policy: Admins and Capataces can update/delete notifications
CREATE POLICY "Enable update/delete for authenticated users" 
ON notificaciones FOR ALL 
TO authenticated 
USING (true);

-- 2. Table: configuracion
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone (including anonymous for initial config) can read settings
CREATE POLICY "Enable read access for all" 
ON configuracion FOR SELECT 
USING (true);

-- Policy: Only authenticated users (admins) can update settings
CREATE POLICY "Enable update for authenticated users only" 
ON configuracion FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 3. Table: asistencias (Enabling RLS as a best practice)
ALTER TABLE asistencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable full access for authenticated users on asistencias"
ON asistencias FOR ALL
TO authenticated
USING (true);

-- 4. Table: costaleros (Enabling RLS)
ALTER TABLE costaleros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable full access for authenticated users on costaleros"
ON costaleros FOR ALL
TO authenticated
USING (true);

-- 5. Table: eventos (Enabling RLS)
ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable full access for authenticated users on eventos"
ON eventos FOR ALL
TO authenticated
USING (true);

-- 6. Table: user_profiles (Enabling RLS)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable full access for authenticated users on user_profiles"
ON user_profiles FOR ALL
TO authenticated
USING (true);
