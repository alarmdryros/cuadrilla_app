-- ========================================================
-- MASTER FIX AUTO-SINCRONIZABLE: Registro y Acceso (v2.0.8)
-- Ejecutar este script en el SQL Editor de Supabase
-- ========================================================

-- 1. Políticas RLS para user_profiles (Propiedad total)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuarios pueden ver su propio perfil" ON public.user_profiles;
CREATE POLICY "Usuarios pueden ver su propio perfil" ON public.user_profiles
  FOR ALL TO authenticated USING (auth.uid() = id);

-- 2. FUNCIÓN DE AUTO-CURACIÓN (v2.0.8)
-- Vincula automáticamente un costebrero recién creado con un usuario Auth ya existente
CREATE OR REPLACE FUNCTION public.sync_existing_user_to_new_costalero()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, role, costalero_id)
  SELECT u.id, u.email, 'costalero', NEW.id
  FROM auth.users u
  WHERE LOWER(u.email) = LOWER(NEW.email)
  ON CONFLICT (id) DO UPDATE SET costalero_id = EXCLUDED.costalero_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger en la tabla de COSTALEROS (Se activa cuando creas/re-creas un costalero)
DROP TRIGGER IF EXISTS tr_sync_user_on_costalero_insert ON public.costaleros;
CREATE TRIGGER tr_sync_user_on_costalero_insert
  AFTER INSERT ON public.costaleros
  FOR EACH ROW EXECUTE FUNCTION public.sync_existing_user_to_new_costalero();

-- 3. Trigger robusto para nuevos registros (A través de RegisterScreen)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, role, costalero_id)
  VALUES (
    NEW.id,
    NEW.email,
    'costalero',
    COALESCE(
      (NEW.raw_user_meta_data->>'costalero_id')::uuid,
      (SELECT id FROM public.costaleros WHERE LOWER(email) = LOWER(NEW.email) LIMIT 1)
    )
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. REPARACIÓN MASIVA INICIAL (Ejecutar una vez para limpiar huérfanos)
INSERT INTO public.user_profiles (id, email, role, costalero_id)
SELECT u.id, u.email, 'costalero', c.id
FROM auth.users u
JOIN public.costaleros c ON LOWER(u.email) = LOWER(c.email)
LEFT JOIN public.user_profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 5. Permisos
GRANT ALL ON TABLE public.user_profiles TO service_role, postgres;
GRANT ALL ON TABLE public.costaleros TO service_role, postgres;
DROP POLICY IF EXISTS "Permitir chequeo de email para registro" ON public.costaleros;
CREATE POLICY "Permitir chequeo de email para registro" ON public.costaleros 
  FOR SELECT TO anon, authenticated USING (true);
