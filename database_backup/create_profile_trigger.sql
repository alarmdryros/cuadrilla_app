-- Función para manejar la creación automática del perfil de usuario
-- Se ejecuta cada vez que un nuevo usuario se registra en auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, role, costalero_id)
  VALUES (
    NEW.id,
    NEW.email,
    'costalero',
    (NEW.raw_user_meta_data->>'costalero_id')::uuid
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para ejecutar la función después de un INSERT en auth.users
-- Primero eliminamos si ya existe para evitar errores al re-ejecutar
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
