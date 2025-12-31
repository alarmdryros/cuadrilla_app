/**
 * NotificationService.js
 * 
 * Versión pivotada: Gestión de notificaciones 100% internas.
 * Se elimina la dependencia de expo-notifications para garantizar
 * compatibilidad total con Expo Go.
 */

export const NotificationService = {
    // Ya no requerimos permisos nativos
    registerForPushNotificationsAsync: async () => {
        console.log('Sistema de notificaciones internas activo (No requiere permisos nativos).');
        return null;
    },

    // El contador de globo (badge) ahora solo se gestiona visualmente en la app
    updateBadgeCount: async (count) => {
        // En esta versión interna, el badge solo vive en los componentes de la UI (Header, Menú)
        return;
    },

    // Programar recordatorios (ahora solo guarda la intención o se ignora en esta fase)
    // Para avisos de 24h/1h, usaremos el NotificationContext para comprobar eventos al abrir la app.
    scheduleEventReminder: async (eventId, eventName, eventDate) => {
        console.log(`Recordatorio interno programado para el evento: ${eventName} (${eventDate})`);
        // Nota: Los avisos se mostrarán al usuario cuando abra la app basándose en la fecha actual.
    },

    cancelEventReminders: async (eventId) => {
        console.log(`Recordatorio interno cancelado para evento ID: ${eventId}`);
    }
};
