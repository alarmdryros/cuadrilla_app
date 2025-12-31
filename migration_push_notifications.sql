-- Tabla para almacenar las suscripciones de notificaciones push
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform TEXT NOT NULL, -- 'web' o 'native'
    device_info JSONB, -- Información opcional del dispositivo
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, token)
);

-- Habilitar RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios pueden ver sus propias suscripciones
CREATE POLICY "Usuarios pueden ver sus suscripciones"
ON public.push_subscriptions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Política: Los usuarios pueden insertar sus propias suscripciones
CREATE POLICY "Usuarios pueden insertar sus suscripciones"
ON public.push_subscriptions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Política: Los usuarios pueden borrar sus propias suscripciones (ej: al cerrar sesión)
CREATE POLICY "Usuarios pueden borrar sus suscripciones"
ON public.push_subscriptions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Política: SuperAdmin puede ver todas las suscripciones (opcional)
CREATE POLICY "SuperAdmin puede ver todo"
ON public.push_subscriptions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'superadmin'
  )
);
