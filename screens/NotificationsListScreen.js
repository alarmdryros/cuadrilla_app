import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { MaterialIcons } from '../components/Icon';
import { useNotifications } from '../contexts/NotificationContext';
import { supabase } from '../supabaseConfig';

export default function NotificationsListScreen({ navigation }) {
    const { notifications, loading, fetchNotifications, markAsRead, deleteNotification, markAllAsRead } = useNotifications();

    useEffect(() => {
        fetchNotifications();
    }, []);

    const handleNotificationPress = async (item) => {
        // 1. Mark as read immediately
        if (!item.leida) {
            markAsRead(item.id);
        }

        // 2. If it is an absence alert, show options
        if (item.tipo === 'aviso_ausencia') {
            Alert.alert(
                "Gestionar Ausencia",
                `¿Qué deseas hacer con el aviso de ${item.emisor?.nombre}?`,
                [
                    { text: "Cancelar", style: "cancel" },
                    {
                        text: "📝 Justificar",
                        onPress: () => processAttendance(item, 'justificado')
                    },
                    {
                        text: "❌ Marcar Ausente",
                        onPress: () => processAttendance(item, 'ausente') // This effectively deletes any 'presente' record
                    },
                    {
                        text: "🗑️ Borrar Mensaje",
                        onPress: () => deleteNotification(item.id),
                        style: 'destructive'
                    }
                ]
            );
        }
    };

    const processAttendance = async (notification, status) => {
        try {
            const { event_id, emisor_id, emisor } = notification;

            // 1. Delete any existing attendance record for this user/event
            const { error: delError } = await supabase
                .from('asistencias')
                .delete()
                .eq('event_id', event_id)
                .eq('costalero_id', emisor_id);

            if (delError) throw delError;

            // 2. If status is 'justificado', insert a new record
            // If status is 'ausente', we just wanted to delete any 'presente' record, so we are done.
            if (status === 'justificado') {
                const { error: insError } = await supabase
                    .from('asistencias')
                    .insert([{
                        event_id: event_id,
                        costalero_id: emisor_id,
                        nombreCostalero: `${emisor?.nombre || ''} ${emisor?.apellidos || ''}`.trim(),
                        timestamp: new Date().toISOString(),
                        status: 'justificado'
                    }]);

                if (insError) throw insError;
            } else {
                const { error: insError } = await supabase
                    .from('asistencias')
                    .insert([{
                        event_id: event_id,
                        costalero_id: emisor_id,
                        nombreCostalero: `${emisor?.nombre || ''} ${emisor?.apellidos || ''}`.trim(),
                        timestamp: new Date().toISOString(),
                        status: 'ausente'
                    }]);

                if (insError) throw insError;
                Alert.alert("Éxito", "Costalero marcado como AUSENTE correctamente.");
            }

        } catch (error) {
            console.error('Error processing attendance:', error);
            Alert.alert("Error", "No se pudo actualizar la asistencia.");
        }
    };

    const handleDelete = (id) => {
        Alert.alert("Confirmar", "¿Eliminar esta notificación?", [
            { text: "Cancelar", style: "cancel" },
            { text: "Eliminar", onPress: () => deleteNotification(id), style: "destructive" }
        ]);
    };

    const renderItem = ({ item }) => (
        <TouchableOpacity
            style={[styles.notificationCard, !item.leida && styles.unreadCard]}
            onPress={() => handleNotificationPress(item)}
        >
            <View style={styles.cardHeader}>
                <View style={styles.headerLeft}>
                    <View style={[styles.iconContainer, { backgroundColor: item.tipo === 'aviso_ausencia' ? '#FFE0E0' : '#E8EAF6' }]}>
                        <MaterialIcons
                            name={item.tipo === 'aviso_ausencia' ? "person-off" : "notifications"}
                            size={20}
                            color={item.tipo === 'aviso_ausencia' ? "#D32F2F" : "#3F51B5"}
                        />
                    </View>
                    <Text style={styles.notifTitle}>{item.titulo}</Text>
                </View>
                {!item.leida && <View style={styles.unreadDot} />}
            </View>

            <View style={styles.cardBody}>
                <Text style={styles.notifFrom}>De: <Text style={styles.boldText}>{item.emisor?.nombre} {item.emisor?.apellidos}</Text></Text>
                <Text style={styles.notifEvent}>Evento: <Text style={styles.italicText}>{item.evento?.nombre}</Text></Text>

                {item.motivo && (
                    <View style={styles.motivoBox}>
                        <Text style={styles.motivoLabel}>Motivo:</Text>
                        <Text style={styles.motivoText}>{item.motivo}</Text>
                    </View>
                )}

                <Text style={styles.notifTime}>
                    {new Date(item.created_at).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </Text>
            </View>

            <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
                <MaterialIcons name="delete-outline" size={24} color="#BDBDBD" />
            </TouchableOpacity>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.actions}>
                <Text style={styles.countText}>{notifications.length} Notificaciones</Text>
                {notifications.some(n => !n.leida) && (
                    <TouchableOpacity onPress={markAllAsRead}>
                        <Text style={styles.readAllText}>Marcar todas como leídas</Text>
                    </TouchableOpacity>
                )}
            </View>

            {loading && notifications.length === 0 ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#5E35B1" />
                </View>
            ) : notifications.length === 0 ? (
                <View style={styles.center}>
                    <MaterialIcons name="notifications-none" size={60} color="#BDBDBD" />
                    <Text style={styles.emptyText}>No hay notificaciones</Text>
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ padding: 15 }}
                    refreshing={loading}
                    onRefresh={fetchNotifications}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F9FA' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    actions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#EEEEEE'
    },
    countText: { fontSize: 13, color: '#757575', fontWeight: 'bold' },
    readAllText: { fontSize: 13, color: '#5E35B1', fontWeight: 'bold' },
    notificationCard: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        position: 'relative'
    },
    unreadCard: {
        borderLeftWidth: 4,
        borderLeftColor: '#5E35B1'
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    iconContainer: { padding: 8, borderRadius: 10, marginRight: 10 },
    notifTitle: { fontSize: 16, fontWeight: '800', color: '#212121' },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#5E35B1' },
    cardBody: { paddingLeft: 46 },
    notifFrom: { fontSize: 14, color: '#616161', marginBottom: 2 },
    notifEvent: { fontSize: 14, color: '#616161', marginBottom: 8 },
    boldText: { fontWeight: '700', color: '#212121' },
    italicText: { fontStyle: 'italic' },
    motivoBox: { backgroundColor: '#F5F5F5', padding: 10, borderRadius: 10, marginBottom: 8 },
    motivoLabel: { fontSize: 11, fontWeight: 'bold', color: '#9E9E9E', marginBottom: 2, textTransform: 'uppercase' },
    motivoText: { fontSize: 13, color: '#424242' },
    notifTime: { fontSize: 11, color: '#BDBDBD', textAlign: 'right' },
    deleteBtn: { position: 'absolute', top: 16, right: 16 },
    emptyText: { marginTop: 10, color: '#BDBDBD', fontSize: 16, fontWeight: '600' }
});
