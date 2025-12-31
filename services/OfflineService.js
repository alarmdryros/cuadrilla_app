import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabaseConfig';

const STORAGE_KEYS = {
    EVENTS: '@offline_events',
    ANNOUNCEMENTS: '@offline_announcements',
    SYNC_QUEUE: '@sync_queue',
};

export const OfflineService = {
    // --- Data Persistence ---
    async saveEvents(events) {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
        } catch (e) {
            console.error('Error saving events offline:', e);
        }
    },

    async getEvents() {
        try {
            const data = await AsyncStorage.getItem(STORAGE_KEYS.EVENTS);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Error getting events offline:', e);
            return [];
        }
    },

    async saveAnnouncements(announcements) {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(announcements));
        } catch (e) {
            console.error('Error saving announcements offline:', e);
        }
    },

    async getAnnouncements() {
        try {
            const data = await AsyncStorage.getItem(STORAGE_KEYS.ANNOUNCEMENTS);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Error getting announcements offline:', e);
            return [];
        }
    },

    // --- Sync Queue Management ---
    async addToSyncQueue(operation) {
        try {
            const queueData = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_QUEUE);
            const queue = queueData ? JSON.parse(queueData) : [];

            // Unify operations on the same entity if possible (e.g., multiple status changes for same attendee)
            const exists = queue.findIndex(q =>
                q.table === operation.table &&
                q.id === operation.id &&
                q.type === operation.type
            );

            if (exists !== -1) {
                queue[exists] = { ...queue[exists], ...operation, timestamp: Date.now() };
            } else {
                queue.push({ ...operation, timestamp: Date.now() });
            }

            await AsyncStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queue));
            return queue.length;
        } catch (e) {
            console.error('Error adding to sync queue:', e);
            return 0;
        }
    },

    async getSyncQueue() {
        try {
            const data = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_QUEUE);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    },

    async clearSyncQueue() {
        await AsyncStorage.removeItem(STORAGE_KEYS.SYNC_QUEUE);
    },

    // --- Synchronization Logic ---
    async processSyncQueue() {
        const queue = await this.getSyncQueue();
        if (queue.length === 0) return true;

        console.log(`Iniciando sincronización de ${queue.length} cambios pendientes...`);
        let successCount = 0;

        for (const op of queue) {
            try {
                if (op.table === 'asistencias') {
                    const { error } = await supabase
                        .from('asistencias')
                        .upsert(op.data, { onConflict: 'evento_id,costalero_id' });

                    if (!error) successCount++;
                }
                // Add more tables here as needed
            } catch (e) {
                console.error('Error syncing operation:', op, e);
            }
        }

        if (successCount === queue.length) {
            await this.clearSyncQueue();
            console.log('Sincronización completada con éxito.');
            return true;
        } else {
            // Remove successfully synced items from queue
            // Simplified: for now just keep queue if any fail
            return false;
        }
    }
};
