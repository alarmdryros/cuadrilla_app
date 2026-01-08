-- ============================================
-- SCRIPT DE CONFIGURACIÓN: SISTEMA DE ROLES
-- ============================================
-- Ejecutar este script en Supabase SQL Editor
-- ============================================

-- 1. Crear tabla de perfiles de usuario
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role TEXT CHECK (role IN ('admin', 'capataz', 'costalero')) NOT NULL DEFAULT 'costalero',
  costalero_id UUID REFERENCES costaleros(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Hacer email obligatorio en costaleros (si no lo es ya)
-- IMPORTANTE: Asegúrate de que todos los costaleros existentes tengan email antes de ejecutar esto
-- ALTER TABLE costaleros 
--   ALTER COLUMN email SET NOT NULL,
--   ADD CONSTRAINT unique_costalero_email UNIQUE (email);

-- 3. Función para vincular automáticamente usuario con costalero
CREATE OR REPLACE FUNCTION link_user_to_costalero()
RETURNS TRIGGER AS $$
BEGIN
  -- Si el rol es costalero, buscar y vincular con el registro de costalero
  IF NEW.role = 'costalero' THEN
    UPDATE user_profiles
    SET costalero_id = (
      SELECT id FROM costaleros WHERE email = NEW.email LIMIT 1
    )
    WHERE id = NEW.id AND costalero_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger para ejecutar la función al insertar un nuevo perfil
DROP TRIGGER IF EXISTS auto_link_costalero ON user_profiles;
CREATE TRIGGER auto_link_costalero
  AFTER INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION link_user_to_costalero();

-- 5. Habilitar Row Level Security (RLS) en tablas principales
ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE costaleros ENABLE ROW LEVEL SECURITY;
ALTER TABLE asistencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 6. Políticas para EVENTOS
-- Todos pueden ver eventos
DROP POLICY IF EXISTS "Everyone can view events" ON eventos;
CREATE POLICY "Everyone can view events" ON eventos 
  FOR SELECT USING (true);

-- Admin y Capataz pueden crear/editar/eliminar
DROP POLICY IF EXISTS "Admin and Capataz can manage events" ON eventos;
CREATE POLICY "Admin and Capataz can manage events" ON eventos 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'capataz')
    )
  );

-- 7. Políticas para COSTALEROS
-- Admin y Capataz pueden ver todos
DROP POLICY IF EXISTS "Admin and Capataz can view all costaleros" ON costaleros;
CREATE POLICY "Admin and Capataz can view all costaleros" ON costaleros 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'capataz')
    )
  );

-- Costaleros solo pueden ver su propio perfil
DROP POLICY IF EXISTS "Costaleros can view own profile" ON costaleros;
CREATE POLICY "Costaleros can view own profile" ON costaleros 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
        AND role = 'costalero' 
        AND costalero_id = costaleros.id
    )
  );

-- Admin y Capataz pueden crear costaleros
DROP POLICY IF EXISTS "Admin and Capataz can insert costaleros" ON costaleros;
CREATE POLICY "Admin and Capataz can insert costaleros" ON costaleros 
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'capataz')
    )
  );

-- Admin y Capataz pueden editar costaleros
DROP POLICY IF EXISTS "Admin and Capataz can update costaleros" ON costaleros;
CREATE POLICY "Admin and Capataz can update costaleros" ON costaleros 
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'capataz')
    )
  );

-- Solo Admin puede eliminar costaleros
DROP POLICY IF EXISTS "Only Admin can delete costaleros" ON costaleros;
CREATE POLICY "Only Admin can delete costaleros" ON costaleros 
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 8. Políticas para ASISTENCIAS
-- Todos pueden ver asistencias
DROP POLICY IF EXISTS "Everyone can view asistencias" ON asistencias;
CREATE POLICY "Everyone can view asistencias" ON asistencias 
  FOR SELECT USING (true);

-- Admin y Capataz pueden gestionar todas las asistencias
DROP POLICY IF EXISTS "Admin and Capataz can manage asistencias" ON asistencias;
CREATE POLICY "Admin and Capataz can manage asistencias" ON asistencias 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'capataz')
    )
  );

-- Costaleros pueden crear su propia asistencia
DROP POLICY IF EXISTS "Costaleros can create own asistencia" ON asistencias;
CREATE POLICY "Costaleros can create own asistencia" ON asistencias 
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
        AND role = 'costalero' 
        AND costalero_id = asistencias.costalero_id
    )
  );

-- 9. Políticas para USER_PROFILES
-- Usuarios pueden ver su propio perfil
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
CREATE POLICY "Users can view own profile" ON user_profiles 
  FOR SELECT USING (id = auth.uid());

-- Usuarios pueden actualizar su propio perfil
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile" ON user_profiles 
  FOR UPDATE USING (id = auth.uid());

-- Permitir INSERT para nuevos usuarios (necesario para registro)
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile" ON user_profiles 
  FOR INSERT WITH CHECK (id = auth.uid());

-- Admin puede ver todos los perfiles (sin recursión)
DROP POLICY IF EXISTS "Admin can view all profiles" ON user_profiles;
CREATE POLICY "Admin can view all profiles" ON user_profiles 
  FOR SELECT USING (
    id = auth.uid() OR 
    (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) = 'admin'
  );

-- Admin puede gestionar todos los perfiles (sin recursión)
DROP POLICY IF EXISTS "Admin can manage profiles" ON user_profiles;
CREATE POLICY "Admin can manage profiles" ON user_profiles 
  FOR ALL USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) = 'admin'
  );

-- 10. Crear primer usuario admin (EJECUTAR SOLO UNA VEZ)
-- IMPORTANTE: Reemplaza 'admin@cuadrilla.com' con tu email real
-- Este usuario debe registrarse primero en la app, luego ejecutar esto:
-- INSERT INTO user_profiles (id, email, role)
-- VALUES (
--   (SELECT id FROM auth.users WHERE email = 'admin@cuadrilla.com'),
--   'admin@cuadrilla.com',
--   'admin'
-- );

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
