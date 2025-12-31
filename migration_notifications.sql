-- Create notificaciones table
CREATE TABLE notificaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    emisor_id UUID REFERENCES costaleros(id),
    tipo TEXT NOT NULL, -- 'aviso_ausencia'
    titulo TEXT,
    mensaje TEXT,
    motivo TEXT, -- Reason for absence
    event_id UUID REFERENCES eventos(id),
    leida BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for performance
CREATE INDEX idx_notificaciones_leida ON notificaciones(leida);
CREATE INDEX idx_notificaciones_event_id ON notificaciones(event_id);
