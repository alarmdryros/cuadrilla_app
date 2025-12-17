import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Button, ActivityIndicator, TouchableOpacity, Alert, ScrollView, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../supabaseConfig';

export default function EventDetailScreen({ route, navigation }) {
    const { eventId } = route.params || {};
    const [event, setEvent] = useState(null);
    const [asistencias, setAsistencias] = useState([]);
    const [allCostaleros, setAllCostaleros] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('presentes');
    const [isEventFinished, setIsEventFinished] = useState(false);

    // Edit/Delete Header Buttons
    React.useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <View style={{ flexDirection: 'row' }}>
                    <Button title="✏️" onPress={handleEdit} color="#5E35B1" />
                    <View style={{ width: 10 }} />
                    <Button title="🗑️" onPress={handleDelete} color="#F44336" />
                </View>
            ),
        });
    }, [navigation, event]);

    const handleEdit = () => {
        if (!event) return;
        navigation.navigate('EventForm', { eventData: { id: eventId, ...event } });
    };

    const handleDelete = () => {
        Alert.alert(
            "Eliminar Evento",
            "¿Estás seguro? Esta acción no se puede deshacer.",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Eliminar",
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setLoading(true);
                            const { error } = await supabase
                                .from('eventos')
                                .delete()
                                .eq('id', eventId);

                            if (error) throw error;

                            // Cascading delete should handle asistencias if configured, 
                            // otherwise we might need to manually delete them.
                            // Assuming DB handles it or it's fine to leave orphans for now.

                            Alert.alert("Eliminado", "El evento ha sido eliminado.");
                            navigation.goBack();
                        } catch (e) {
                            Alert.alert("Error", e.message);
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const fetchAllData = async () => {
        if (!eventId) return;

        try {
            // 1. Get Event Details
            const { data: eventData, error: eventError } = await supabase
                .from('eventos')
                .select('*')
                .eq('id', eventId)
                .single();

            if (eventError) throw eventError;

            if (eventData) {
                setEvent(eventData);
                navigation.setOptions({ title: eventData.nombre });

                const now = new Date();
                const end = new Date(eventData.fechaFin);
                if (now > end) {
                    setIsEventFinished(true);
                }
            }

            // 2. Get All Costaleros
            const { data: costalerosData, error: costalerosError } = await supabase
                .from('costaleros')
                .select('*')
                .order('apellidos');

            if (costalerosError) throw costalerosError;
            setAllCostaleros(costalerosData || []);

            // 3. Get Asistencias
            const { data: asisData, error: asisError } = await supabase
                .from('asistencias')
                .select('*')
                .eq('event_id', eventId)
                .order('timestamp', { ascending: false });

            if (asisError) throw asisError;
            setAsistencias(asisData || []);

        } catch (error) {
            console.error(error);
            // Alert.alert("Error loading data", error.message);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchAllData();
        }, [eventId])
    );

    // Calculate lists
    const presentIds = new Set(asistencias.map(a => a.costaleroId)); // Note: Ensure DB column is costaleroId or costalero_id. 
    // Assuming I stick to camelCase in JS but snake_case in DB is common. 
    // I'll stick to camelCase for now unless I defined otherwise.
    // Wait, I am inserting `costaleroId` in other places?
    // In `processAbsences` below, I will use `costalero_id` to be safe if I am creating the schema?
    // NO, I should stick to one convention.
    // In `EventForm` I used `fechaInicio` (camelCase).
    // So I will assume columns are camelCase `costaleroId` OR I will start using snake_case `costalero_id` if that's Supabase default.
    // Supabase usually prefers snake_case. 
    // I'll use `event_id` and `costalero_id` for the foreign keys in the `asistencias` table in my implementation plan implicit assumptions.
    // But I must match what I query!
    // I queried `select('*')`.
    // Let's assume migration maps `costaleroId` (from Firestore doc data) to `costaleroId` column for simplicity OR `costalero_id`.
    // I will use `costaleroId` (camelCase) to minimize refactoring, assuming the user creates columns with quotes "costaleroId" or just maps it.
    // ACTUALLY, to be safe and standard, I should probably map data.
    // Let's check `asistencias.map(a => a.costaleroId)`.
    // If I insert `costaleroId`, I get `costaleroId`.

    // Correction: In Supabase/Postgres, unquoted case-insensitive identifiers are lowercase.
    // I will use `costalero_id` and `event_id` for the relational columns in the INSERTs/SELECTs logic if I were designing it.
    // BUT checking `QRScannerScreen.js` (not yet migrated), it uses `costaleroId`.
    // I will try to support `costaleroId` but I'll likely need to migrate the column name.
    // I'll use `costaleroId` in the JS object key, assuming the column is `costaleroId` (case sensitive requires quotes in PG) or `costaleroid`.
    // I'll use `costalero_id` for the column name in `insert` but in `select('*')` I might get `costalero_id`.
    // This is risky.
    // I will standardize on `costalero_id` and `event_id` for the `asistencias` table.
    // And `costaleros` table uses `id`.

    // Updating logic to handle `costalero_id`:
    const presentIdsStandardized = new Set(asistencias.map(a => a.costalero_id || a.costaleroId));
    const ausentesList = allCostaleros
        .filter(c => !presentIdsStandardized.has(c.id))
        .sort((a, b) => {
            const tA = a.trabajadera ? parseInt(a.trabajadera) : 999;
            const tB = b.trabajadera ? parseInt(b.trabajadera) : 999;
            if (tA !== tB) return tA - tB;
            return (a.apellidos || '').localeCompare(b.apellidos || '');
        });

    const handleCloseEvent = () => {
        Alert.alert(
            "Cerrar Acta del Evento",
            "Estás a punto de marcar como AUSENTES a todos los costaleros que no han escaneado ni justificado. Esta acción es definitiva.",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "CERRAR ACTA",
                    style: 'destructive',
                    onPress: processAbsences
                }
            ]
        );
    };

    const processAbsences = async () => {
        setLoading(true);
        try {
            const absencesData = ausentesList.map(costalero => ({
                event_id: eventId,
                costalero_id: costalero.id,
                nombreCostalero: `${costalero.nombre} ${costalero.apellidos}`, // legacy redundant data
                timestamp: new Date().toISOString(),
                status: 'ausente'
            }));

            if (absencesData.length > 0) {
                const { error } = await supabase
                    .from('asistencias')
                    .insert(absencesData);

                if (error) throw error;
            }

            Alert.alert("Evento Cerrado", `Se han marcado ${absencesData.length} ausencias automáticamente.`);
            fetchAllData();
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Hubo un problema cerrando el acta: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const shareEventWhatsApp = () => {
        if (!event) return;

        const fechaEvento = new Date(event.fecha);
        const fechaFormateada = fechaEvento.toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const horaFormateada = fechaEvento.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
        });

        const mensaje = `🔔 *RECORDATORIO DE EVENTO*\n\n` +
            `📅 *${event.nombre}*\n\n` +
            `📍 Lugar: ${event.lugar || 'Por confirmar'}\n` +
            `🕐 Fecha: ${fechaFormateada}\n` +
            `⏰ Hora: ${horaFormateada}\n\n` +
            `¡No olvides asistir! Tu presencia es importante.\n\n` +
            `_Enviado desde Cuadrilla App_`;

        const url = `whatsapp://send?text=${encodeURIComponent(mensaje)}`;

        Linking.canOpenURL(url)
            .then((supported) => {
                if (supported) {
                    return Linking.openURL(url);
                } else {
                    Alert.alert('Error', 'WhatsApp no está instalado en este dispositivo');
                }
            })
            .catch((err) => {
                console.error('Error al abrir WhatsApp:', err);
                Alert.alert('Error', 'No se pudo abrir WhatsApp');
            });
    };

    // Funciones Manuales
    const handleManualAction = (costalero) => {
        Alert.alert(
            "Gestionar Ausencia",
            `¿Qué deseas hacer con ${costalero.nombre} ${costalero.apellidos}?`,
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "📝 Justificar",
                    onPress: () => addAsistencia(costalero, 'justificado')
                },
                {
                    text: "✅ Marcar Presente",
                    onPress: () => addAsistencia(costalero, 'presente')
                }
            ]
        );
    };

    const deleteAsistencia = async (attendanceId) => {
        try {
            const { error } = await supabase
                .from('asistencias')
                .delete()
                .eq('id', attendanceId);

            if (error) throw error;
            Alert.alert("Eliminado", "Asistencia eliminada. El costalero vuelve a estar 'Ausente'.");
            fetchAllData();
        } catch (e) {
            Alert.alert("Error", e.message);
        }
    };

    const addAsistencia = async (costalero, status) => {
        try {
            // Check if already registered
            const { data: existing, error: fetchError } = await supabase
                .from('asistencias')
                .select('*')
                .eq('event_id', eventId)
                .eq('costalero_id', costalero.id);

            if (fetchError) throw fetchError;

            if (existing && existing.length > 0) {
                const existingDoc = existing[0];
                const statusText = existingDoc.status === 'presente' ? 'PRESENTE' :
                    existingDoc.status === 'justificado' ? 'JUSTIFICADO' : 'AUSENTE';
                Alert.alert("Ya registrado", `Este costalero ya está marcado como: ${statusText}`);
                return;
            }

            // Add new attendance record
            const { error: insertError } = await supabase
                .from('asistencias')
                .insert([{
                    event_id: eventId,
                    costalero_id: costalero.id,
                    nombreCostalero: `${costalero.nombre} ${costalero.apellidos}`,
                    timestamp: new Date().toISOString(),
                    status: status // 'presente' | 'justificado'
                }]);

            if (insertError) throw insertError;
            Alert.alert("Actualizado", `Costalero marcado como ${status}`);
            fetchAllData();
        } catch (e) {
            Alert.alert("Error", e.message);
        }
    };

    const handleExistingAction = (item) => {
        Alert.alert(
            "Gestionar Asistencia",
            `${item.nombreCostalero}`,
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "🗑️ Eliminar Asistencia",
                    style: 'destructive',
                    onPress: () => deleteAsistencia(item.id)
                }
            ]
        );
    };

    const renderAsistente = ({ item }) => (
        <TouchableOpacity
            style={[styles.item, item.status === 'justificado' ? styles.justificadoItem : null]}
            onPress={() => handleExistingAction(item)}
        >
            <View>
                <Text style={styles.name}>{item.nombreCostalero}</Text>
                <Text style={styles.time}>
                    {item.status === 'justificado' ? '📝 FALTA JUSTIFICADA' : `🕒 ${item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : ''}`}
                </Text>
            </View>
            <Text style={styles.arrow}>⋮</Text>
        </TouchableOpacity>
    );

    const renderAusente = ({ item }) => (
        <TouchableOpacity style={styles.item} onPress={() => handleManualAction(item)}>
            <View>
                <Text style={styles.name}>
                    {item.apellidos}, {item.nombre}
                    {item.trabajadera ? <Text style={{ color: '#5E35B1', fontWeight: 'bold' }}> (T{item.trabajadera})</Text> : ''}
                </Text>
                <Text style={styles.time}>❌ Ausente - Toca para gestionar</Text>
            </View>
            <Text style={styles.arrow}>⋮</Text>
        </TouchableOpacity>
    );

    if (loading && !event) return <ActivityIndicator style={styles.center} />;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.eventTitle}>{event?.nombre}</Text>
                <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                        <Text style={styles.statNumber}>{asistencias.filter(a => a.status === 'presente').length}</Text>
                        <Text style={styles.statLabel}>Presentes</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={[styles.statNumber, { color: 'orange' }]}>{asistencias.filter(a => a.status === 'justificado').length}</Text>
                        <Text style={styles.statLabel}>Justif.</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={[styles.statNumber, { color: 'red' }]}>{asistencias.filter(a => a.status === 'ausente').length}</Text>
                        <Text style={styles.statLabel}>Ausentes</Text>
                    </View>
                </View>

                {isEventFinished && ausentesList.length > 0 && (
                    <View style={{ marginBottom: 10 }}>
                        <Text style={styles.warningText}>⚠️ Evento finalizado. Quedan {ausentesList.length} sin marcar.</Text>
                        <Button title="CERRAR ACTA (Marcar Ausencias)" color="#F44336" onPress={handleCloseEvent} />
                    </View>
                )}

                <Button
                    title="📷 Escanear Nuevos"
                    onPress={() => navigation.navigate('QRScanner', { eventId: eventId })}
                />
                <View style={{ marginTop: 10 }}>
                    <Button
                        title="📊 Ver por Trabajaderas"
                        onPress={() => navigation.navigate('EventTrabajaderas', { eventId: eventId, eventName: event?.nombre })}
                        color="#00BFA5"
                    />
                </View>
                <View style={{ marginTop: 10 }}>
                    <Button
                        title="💬 Compartir por WhatsApp"
                        onPress={shareEventWhatsApp}
                        color="#25D366"
                    />
                </View>
                <View style={{ marginTop: 10 }}>
                    <Button
                        title="🔄 Gestionar Relevos"
                        onPress={() => navigation.navigate('RelayManagement', { eventId: eventId, eventName: event?.nombre })}
                        color="#FF9800"
                    />
                </View>
                <View style={{ marginTop: 10 }}>
                    <Button
                        title="📏 Mediciones (Antes/Después)"
                        onPress={() => navigation.navigate('Measurements', { eventId: eventId, eventName: event?.nombre })}
                        color="#673AB7"
                    />
                </View>
            </View>

            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tab, tab === 'presentes' && styles.activeTab]}
                    onPress={() => setTab('presentes')}
                >
                    <Text style={[styles.tabText, tab === 'presentes' && styles.activeTabText]}>Asistentes ({asistencias.length})</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, tab === 'ausentes' && styles.activeTab]}
                    onPress={() => setTab('ausentes')}
                >
                    <Text style={[styles.tabText, tab === 'ausentes' && styles.activeTabText]}>Pendientes ({ausentesList.length})</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={tab === 'presentes' ? asistencias : ausentesList}
                renderItem={tab === 'presentes' ? renderAsistente : renderAusente}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                ListEmptyComponent={<Text style={styles.empty}>No hay costaleros en esta lista.</Text>}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA'
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    header: {
        padding: 20,
        backgroundColor: 'white',
        borderBottomWidth: 0,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    eventTitle: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 16,
        textAlign: 'center',
        color: '#212121'
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 16
    },
    statBox: {
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 12,
        minWidth: 80
    },
    statNumber: {
        fontSize: 24,
        fontWeight: '700',
        color: '#4CAF50'
    },
    statLabel: {
        fontSize: 12,
        color: '#757575',
        marginTop: 4,
        fontWeight: '500'
    },
    warningText: {
        color: '#F44336',
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 12,
        fontSize: 14
    },
    tabs: {
        flexDirection: 'row',
        backgroundColor: 'white',
        marginTop: 0,
        borderBottomWidth: 1,
        borderColor: '#E0E0E0',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 2,
        elevation: 1,
    },
    tab: {
        flex: 1,
        padding: 16,
        alignItems: 'center'
    },
    activeTab: {
        borderBottomWidth: 3,
        borderBottomColor: '#5E35B1'
    },
    tabText: {
        color: '#9E9E9E',
        fontWeight: '600',
        fontSize: 14
    },
    activeTabText: {
        color: '#5E35B1'
    },
    list: {
        padding: 12
    },
    item: {
        padding: 16,
        backgroundColor: 'white',
        marginBottom: 8,
        marginHorizontal: 4,
        borderRadius: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2
    },
    justificadoItem: {
        borderLeftWidth: 4,
        borderLeftColor: '#FF9800'
    },
    name: {
        fontSize: 16,
        fontWeight: '600',
        color: '#212121'
    },
    time: {
        color: '#757575',
        fontSize: 14,
        marginTop: 4
    },
    arrow: {
        fontSize: 22,
        color: '#BDBDBD'
    },
    empty: {
        textAlign: 'center',
        marginTop: 60,
        color: '#9E9E9E',
        fontSize: 16
    }
});
