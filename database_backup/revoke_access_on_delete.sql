-- Asegurar que al borrar un costalero se borre su perfil de usuario (revocando acceso)
ALTER TABLE user_profiles
DROP CONSTRAINT IF EXISTS user_profiles_costalero_id_fkey,
ADD CONSTRAINT user_profiles_costalero_id_fkey 
  FOREIGN KEY (costalero_id) 
  REFERENCES costaleros(id) 
  ON DELETE CASCADE;
