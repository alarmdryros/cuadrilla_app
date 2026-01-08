-- ============================================
-- SCRIPT PARA CORREGIR POLÍTICAS RLS
-- Ejecutar SOLO esta parte en Supabase SQL Editor
-- ============================================

-- 1. ELIMINAR TODAS LAS POLÍTICAS EXISTENTES
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admin can manage profiles" ON user_profiles;

-- 2. DESHABILITAR RLS TEMPORALMENTE PARA user_profiles
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- 3. RE-HABILITAR RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 4. CREAR POLÍTICAS SIMPLES SIN RECURSIÓN
-- Permitir a todos los usuarios autenticados leer y escribir su propio perfil
CREATE POLICY "Enable all for users based on user_id" ON user_profiles
  FOR ALL 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
