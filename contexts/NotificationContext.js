import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { supabase } from '../supabaseConfig';
import { useAuth } from './AuthContext';
import { NotificationService } from '../services/NotificationService';
import { Alert } from 'react-native';

const NotificationContext = createContext({});

export const NotificationProvider = ({ children }) => {
    const { user, userRole } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    // Track alerted events to avoid spamming the user (using ref to avoid stale closure in interval)
    const notifiedEventsRef = useRef(new Set());

    const isAdmin = userRole === 'admin' || userRole === 'capataz';

    useEffect(() => {
        if (user) {
            fetchNotifications();

            // Check for upcoming events (reminders)
            checkUpcomingEvents();

            // Subscribe to new notifications
            const subscription = supabase
                .channel('notificaciones_changes')
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificaciones' }, payload => {
                    if (isAdmin) {
                        fetchNotifications();

                        // Foreground alert
                        const title = payload.new.tipo === 'aviso_ausencia' ? 'Aviso de Ausencia' : 'Nueva Notificación';
                        Alert.alert(title, payload.new.mensaje);
                    }
                })
                .subscribe();

            // Set up periodic check (every 1 minute)
            const intervalId = setInterval(() => {
                checkUpcomingEvents();
            }, 60000);

            return () => {
                supabase.removeChannel(subscription);
                clearInterval(intervalId);
            };
        }
    }, [user, userRole]);

    const checkUpcomingEvents = async () => {
        try {
            const now = new Date();
            const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

            const { data: events, error } = await supabase
                .from('eventos')
                .select('*')
                .gt('fechaInicio', now.toISOString())
                .lt('fechaInicio', tomorrow.toISOString());

            if (error) throw error;

            events.forEach(event => {
                // Determine alert type ID to avoid duplicates (e.g., eventID-24h, eventID-1h)
                const alertId24h = `${event.id}-24h`;
                const alertId1h = `${event.id}-1h`;

                const eventDate = new Date(event.fechaInicio);
                const diffMs = eventDate - now;
                const diffHours = diffMs / (1000 * 60 * 60);

                // If less than 1 hour remains
                if (diffHours <= 1) {
                    if (!notifiedEventsRef.current.has(alertId1h)) {
                        Alert.alert(
                            "⏳ ¡Casi empezamos!",
                            `El evento "${event.nombre}" comienza en menos de 1 hora (${eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}).`
                        );
                        notifiedEventsRef.current.add(alertId1h);
                    }
                }
                // If less than 24 hours remain but more than 23 (to show only once when near 24h)
                else if (diffHours <= 24 && diffHours > 23) {
                    if (!notifiedEventsRef.current.has(alertId24h)) {
                        Alert.alert(
                            "📅 Recordatorio: Mañana",
                            `Mañana tienes el evento: ${event.nombre} a las ${eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
                        );
                        notifiedEventsRef.current.add(alertId24h);
                    }
                }
            });
        } catch (error) {
            console.error('Error checking reminders:', error);
        }
    };

    const fetchNotifications = async () => {
        if (!user) return;
        setLoading(true);
        try {
            let query = supabase
                .from('notificaciones')
                .select('*, emisor:costaleros!notificaciones_emisor_id_fkey(nombre, apellidos), evento:eventos(nombre)')
                .order('created_at', { ascending: false });

            // If not admin, return (costaleros don't receive notifications for now)
            if (!isAdmin) {
                return;
            }

            const { data, error } = await query;
            if (error) throw error;

            setNotifications(data || []);
            setUnreadCount((data || []).filter(n => !n.leida).length);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async (id) => {
        try {
            const { error } = await supabase
                .from('notificaciones')
                .update({ leida: true })
                .eq('id', id);

            if (error) throw error;
            fetchNotifications();
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            const { error } = await supabase
                .from('notificaciones')
                .update({ leida: true })
                .eq('leida', false);

            if (error) throw error;
            fetchNotifications();
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    const deleteNotification = async (id) => {
        try {
            const { error } = await supabase
                .from('notificaciones')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchNotifications();
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    };

    const sendAbsenceNotification = async (eventId, costaleroId, eventName, motivo) => {
        try {
            const { error } = await supabase
                .from('notificaciones')
                .insert([{
                    emisor_id: costaleroId,
                    event_id: eventId,
                    tipo: 'aviso_ausencia',
                    titulo: 'Aviso de Ausencia',
                    mensaje: `Un costalero ha avisado que no podrá asistir al evento: ${eventName}`,
                    motivo: motivo,
                    leida: false
                }]);

            if (error) throw error;
        } catch (error) {
            console.error('Error sending notification:', error);
            throw error;
        }
    };

    const value = {
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        sendAbsenceNotification
    };

    return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within NotificationProvider');
    }
    return context;
};
