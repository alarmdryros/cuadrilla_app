-- Solucion para el error de RLS en push_subscriptions
-- Falta la política de UPDATE para que funcione el 'upsert'

-- 1. Política para permitir ACTUALIZAR (UPDATE)
CREATE POLICY "Usuarios pueden actualizar sus suscripciones"
ON public.push_subscriptions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
