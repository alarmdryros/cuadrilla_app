CREATE POLICY "Permitir update a administradores y capataces" 
ON public.anuncios 
FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND (user_profiles.role = 'admin' OR user_profiles.role = 'capataz' OR user_profiles.role = 'superadmin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND (user_profiles.role = 'admin' OR user_profiles.role = 'capataz' OR user_profiles.role = 'superadmin')
  )
);
