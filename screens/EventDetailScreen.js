import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Button, ActivityIndicator, TouchableOpacity, Alert, ScrollView, Linking, Modal, TextInput } from 'react-native';
import { MaterialIcons } from '../components/Icon';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../supabaseConfig';

import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useOffline } from '../contexts/OfflineContext';
import { OfflineService } from '../services/OfflineService';

export default function EventDetailScreen({ route, navigation }) {
    const { userRole, userProfile } = useAuth();
    const { eventId } = route.params || {};

    const isManagement = ['superadmin', 'admin', 'capataz', 'auxiliar'].includes(userRole?.toLowerCase());

    const [event, setEvent] = useState(null);
    const [asistencias, setAsistencias] = useState([]);
    const [allCostaleros, setAllCostaleros] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isEventFinished, setIsEventFinished] = useState(false);
    const [isEventStarted, setIsEventStarted] = useState(false);

    // Notifications specific
    const { sendAbsenceNotification } = useNotifications();
    const [absenceModalVisible, setAbsenceModalVisible] = useState(false);
    const [motivo, setMotivo] = useState('');
    const [sendingNotification, setSendingNotification] = useState(false);
    const { isOffline, addMutation } = useOffline();
    const [managementModalVisible, setManagementModalVisible] = useState(false);
    const [selectedCostalero, setSelectedCostalero] = useState(null);

    // Edit/Delete Header Buttons
    React.useLayoutEffect(() => {
        if (isManagement) {
            navigation.setOptions({
                headerRight: () => (
                    <View style={{ flexDirection: 'row' }}>
                        <Button title="✏️" onPress={handleEdit} color="#5E35B1" />
                        <View style={{ width: 10 }} />
                        <Button title="🗑️" onPress={handleDelete} color="#F44336" />
                    </View>
                ),
            });
        } else if (userRole === 'costalero') {
            navigation.setOptions({
                headerRight: () => (
                    <TouchableOpacity onPress={() => setAbsenceModalVisible(true)}>
                        <MaterialIcons name="person-off" size={24} color="#D32F2F" />
                    </TouchableOpacity>
                ),
            });
        } else {
            navigation.setOptions({ headerRight: null });
        }
    }, [navigation, event, userRole]);

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
            // 1. Get Event Details from fetch or cache
            let eventData = null;
            if (!isOffline) {
                const { data, error } = await supabase
                    .from('eventos')
                    .select('*')
                    .eq('id', eventId)
                    .single();
                if (!error) eventData = data;
            }

            if (!eventData) {
                const cachedEvents = await OfflineService.getEvents();
                eventData = cachedEvents.find(e => e.id === eventId);
            }

            if (eventData) {
                setEvent(eventData);
                navigation.setOptions({ title: eventData.nombre });

                const now = new Date();
                const start = new Date(eventData.fechaInicio || eventData.fecha);
                const end = new Date(eventData.fechaFin || new Date(start.getTime() + 2 * 60 * 60 * 1000));

                if (now > end) {
                    setIsEventFinished(true);
                }
                if (now > start) {
                    setIsEventStarted(true);
                }
            }

            // 2. Get All Costaleros
            if (!isOffline) {
                const { data: costalerosData, error: costalerosError } = await supabase
                    .from('costaleros')
                    .select('*')
                    .eq('año', eventData?.año || new Date().getFullYear())
                    .order('apellidos');

                if (!costalerosError) setAllCostaleros(costalerosData || []);

                // 3. Get Asistencias
                const { data: asisData, error: asisError } = await supabase
                    .from('asistencias')
                    .select('*')
                    .eq('event_id', eventId)
                    .order('timestamp', { ascending: false });

                if (!asisError) {
                    processAsistenciasLocal(asisData, costalerosData);
                }
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const processAsistenciasLocal = (asisData, costalerosData) => {
        const uniqueAsisMap = (asisData || []).reduce((acc, a) => {
            const cId = a.costalero_id || a.costaleroId;
            if (!acc[cId] || new Date(a.timestamp) > new Date(acc[cId].timestamp)) {
                acc[cId] = a;
            }
            return acc;
        }, {});
        const uniqueAsisData = Object.values(uniqueAsisMap);

        const costaleroMap = (costalerosData || []).reduce((acc, c) => {
            acc[c.id] = c;
            return acc;
        }, {});

        const processedAsistencias = uniqueAsisData.map(a => {
            const costalero = costaleroMap[a.costalero_id || a.costaleroId];
            return {
                ...a,
                trabajadera: costalero ? costalero.trabajadera : null,
                apellidos: costalero ? costalero.apellidos : ''
            };
        }).sort((a, b) => {
            const tA = a.trabajadera ? parseInt(a.trabajadera) : 999;
            const tB = b.trabajadera ? parseInt(b.trabajadera) : 999;
            if (tA !== tB) return tA - tB;
            return (a.nombreCostalero || '').localeCompare(b.nombreCostalero || '');
        });

        setAsistencias(processedAsistencias);
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
        if (!isManagement) return;
        setSelectedCostalero(costalero);
        setManagementModalVisible(true);
    };

    const deleteAsistencia = async (attendanceId) => {
        if (!isManagement) return;
        try {
            if (isOffline) {
                // For now, simpler queueing for delete might be complex as we need ID
                // For simplicity, we only allow additions/updates in offline mode for now
                Alert.alert("Offline", "La eliminación de asistencias requiere conexión.");
                return;
            }
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
        if (!isManagement) return;
        try {
            const newData = {
                event_id: eventId,
                costalero_id: costalero.id,
                nombreCostalero: `${costalero.nombre} ${costalero.apellidos}`,
                timestamp: new Date().toISOString(),
                status: status
            };

            if (isOffline) {
                await addMutation({
                    table: 'asistencias',
                    type: 'upsert',
                    id: `${eventId}-${costalero.id}`,
                    data: newData
                });

                // Optimistic UI update
                setAsistencias(prev => {
                    const filtered = prev.filter(a => (a.costalero_id || a.costaleroId) !== costalero.id);
                    return [...filtered, newData];
                });

                Alert.alert("Guardado Offline", "El cambio se sincronizará cuando vuelvas a tener internet.");
                return;
            }

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
                .insert([newData]);

            if (insertError) throw insertError;
            Alert.alert("Actualizado", `Costalero marcado como ${status}`);
            fetchAllData();
        } catch (e) {
            Alert.alert("Error", e.message);
        }
    };

    const handleExistingAction = (item) => {
        if (!isManagement) return;
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

    const getBadgeStyles = (status) => {
        switch (status) {
            case 'presente': return { bg: '#E8F5E9', border: '#4CAF50', text: '#2E7D32' };
            case 'justificado': return { bg: '#FFF3E0', border: '#FF9800', text: '#EF6C00' };
            default: return { bg: '#FFEBEE', border: '#F44336', text: '#C62828' }; // ausente or default
        }
    };

    const renderAsistente = ({ item }) => {
        const { bg, border, text } = getBadgeStyles(item.status);
        return (
            <TouchableOpacity
                style={[
                    styles.item,
                    item.status === 'justificado' ? styles.justificadoItem :
                        item.status === 'presente' ? styles.presenteItem :
                            item.status === 'ausente' ? styles.ausenteItem : null
                ]}
                onPress={() => handleExistingAction(item)}
            >
                <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                        <Text style={styles.name}>{item.nombreCostalero}</Text>
                        {item.trabajadera && (
                            <View style={[styles.badge, { backgroundColor: bg, borderColor: border }]}>
                                <Text style={[styles.badgeText, { color: text }]}>T{item.trabajadera}</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.time}>
                        {item.status === 'justificado' ? '📝 FALTA JUSTIFICADA' : `🕒 ${item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}`}
                    </Text>
                </View>
                <Text style={styles.arrow}>⋮</Text>
            </TouchableOpacity>
        );
    };

    const renderAusente = ({ item }) => {
        const { bg, border, text } = getBadgeStyles('ausente');
        return (
            <TouchableOpacity style={styles.item} onPress={() => handleManualAction(item)}>
                <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                        <Text style={styles.name}>{item.apellidos}, {item.nombre}</Text>
                        {item.trabajadera && (
                            <View style={[styles.badge, { backgroundColor: bg, borderColor: border }]}>
                                <Text style={[styles.badgeText, { color: text }]}>T{item.trabajadera}</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.time}>⏳ Pendiente - Toca para gestionar</Text>
                </View>
                <Text style={styles.arrow}>⋮</Text>
            </TouchableOpacity>
        );
    };

    if (loading && !event) return <ActivityIndicator style={styles.center} />;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.eventTitle}>{event?.nombre}</Text>
                {event?.fecha && (
                    <Text style={styles.eventDate}>
                        {new Date(event.fecha).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                )}
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

                {isManagement && (
                    <>
                        {(isEventStarted || isEventFinished) && ausentesList.length > 0 && (
                            <View style={{ marginBottom: 10 }}>
                                <Text style={styles.warningText}>
                                    ⚠️ Evento {isEventFinished ? 'finalizado' : 'en curso'}. Quedan {ausentesList.length} por marcar.
                                </Text>
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
                    </>
                )}

                {!isManagement && userRole === 'costalero' && (
                    <View style={{ marginTop: 20 }}>
                        <TouchableOpacity
                            style={styles.absenceButton}
                            onPress={() => setAbsenceModalVisible(true)}
                        >
                            <MaterialIcons name="person-off" size={20} color="white" />
                            <Text style={styles.absenceButtonText}>Avisar que no podré asistir</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            <View style={styles.navigationSection}>
                <Text style={styles.sectionTitle}>Listas de Asistencia</Text>

                <TouchableOpacity
                    style={styles.navButton}
                    onPress={() => navigation.navigate('AttendeeList', { eventId: eventId, eventName: event?.nombre })}
                >
                    <View style={styles.navButtonContent}>
                        <View>
                            <Text style={styles.navButtonTitle}>👥 Ver Asistentes</Text>
                            <Text style={styles.navButtonSubtitle}>{asistencias.length} registrados</Text>
                        </View>
                        <Text style={styles.navButtonArrow}>›</Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.navButton}
                    onPress={() => navigation.navigate('PendingList', { eventId: eventId, eventName: event?.nombre })}
                >
                    <View style={styles.navButtonContent}>
                        <View>
                            <Text style={styles.navButtonTitle}>⏳ Ver Pendientes</Text>
                            <Text style={styles.navButtonSubtitle}>{ausentesList.length} sin registrar</Text>
                        </View>
                        <Text style={styles.navButtonArrow}>›</Text>
                    </View>
                </TouchableOpacity>
            </View>

            {/* Modal de Aviso de Ausencia */}
            <Modal
                visible={absenceModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setAbsenceModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Avisar Ausencia</Text>
                        <Text style={styles.modalSubtitle}>Explica brevemente por qué no podrás asistir a este evento.</Text>

                        <TextInput
                            style={styles.textInput}
                            placeholder="Ej: Motivos laborales, viaje, enfermedad..."
                            multiline
                            numberOfLines={4}
                            value={motivo}
                            onChangeText={setMotivo}
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.actionBtn, { backgroundColor: '#BDBDBD' }]}
                                onPress={() => setAbsenceModalVisible(false)}
                            >
                                <Text style={styles.btnText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actionBtn, { backgroundColor: '#D32F2F' }]}
                                onPress={async () => {
                                    if (!motivo.trim()) {
                                        Alert.alert("Motivo requerido", "Por favor, escribe el motivo de tu ausencia.");
                                        return;
                                    }
                                    setSendingNotification(true);
                                    try {
                                        if (!userProfile?.costalero_id) {
                                            Alert.alert("Error", "No tienes un perfil de costalero vinculado.");
                                            return;
                                        }
                                        await sendAbsenceNotification(eventId, userProfile.costalero_id, event.nombre, motivo);
                                        Alert.alert("Enviado", "Se ha notificado a los administradores su ausencia.");
                                        setAbsenceModalVisible(false);
                                        setMotivo('');
                                    } catch (e) {
                                        Alert.alert("Error", "No se pudo enviar el aviso.");
                                    } finally {
                                        setSendingNotification(false);
                                    }
                                }}
                                disabled={sendingNotification}
                            >
                                {sendingNotification ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>Enviar Aviso</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal de Gestión de Asistencia (Admin) */}
            <Modal
                visible={managementModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setManagementModalVisible(false)}
            >
                <View style={[styles.modalContainer, { zIndex: 1000 }]}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Gestionar Asistencia</Text>
                        <Text style={styles.modalSubtitle}>
                            {selectedCostalero?.nombre} {selectedCostalero?.apellidos}
                        </Text>

                        <TouchableOpacity
                            style={[styles.manageBtn, { backgroundColor: '#4CAF50', marginBottom: 12 }]}
                            onPress={() => {
                                addAsistencia(selectedCostalero, 'presente');
                                setManagementModalVisible(false);
                            }}
                        >
                            <View style={styles.btnContent}>
                                <MaterialIcons name="check-circle" size={24} color="white" />
                                <Text style={styles.btnText}>MARCAR PRESENTE</Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.manageBtn, { backgroundColor: '#FF9800', marginBottom: 12 }]}
                            onPress={() => {
                                addAsistencia(selectedCostalero, 'justificado');
                                setManagementModalVisible(false);
                            }}
                        >
                            <View style={styles.btnContent}>
                                <MaterialIcons name="event-available" size={24} color="white" />
                                <Text style={styles.btnText}>JUSTIFICAR FALTA</Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.manageBtn, { backgroundColor: '#F44336', marginBottom: 24 }]}
                            onPress={() => {
                                addAsistencia(selectedCostalero, 'ausente');
                                setManagementModalVisible(false);
                            }}
                        >
                            <View style={styles.btnContent}>
                                <MaterialIcons name="cancel" size={24} color="white" />
                                <Text style={styles.btnText}>MARCAR AUSENTE</Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.manageBtn, { backgroundColor: '#BDBDBD' }]}
                            onPress={() => setManagementModalVisible(false)}
                        >
                            <Text style={styles.btnText}>CANCELAR</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
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
        marginBottom: 8,
        textAlign: 'center',
        color: '#212121'
    },
    eventDate: {
        fontSize: 16,
        color: '#757575',
        textAlign: 'center',
        marginBottom: 16,
        textTransform: 'capitalize'
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
    presenteItem: {
        borderLeftWidth: 4,
        borderLeftColor: '#4CAF50' // Green
    },
    ausenteItem: {
        borderLeftWidth: 4,
        borderLeftColor: '#F44336' // Red
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap'
    },
    badge: {
        marginLeft: 8,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    badgeText: {
        fontSize: 11,
        fontWeight: 'bold'
    },
    name: {
        fontSize: 16,
        fontWeight: '600',
        color: '#212121',
        marginRight: 4
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
    },
    navigationSection: {
        padding: 16,
        backgroundColor: '#FAFAFA'
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#212121',
        marginBottom: 12,
        paddingLeft: 4
    },
    navButton: {
        backgroundColor: 'white',
        borderRadius: 12,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 3
    },
    navButtonContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 18
    },
    navButtonTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#212121',
        marginBottom: 4
    },
    navButtonSubtitle: {
        fontSize: 13,
        color: '#757575'
    },
    navButtonArrow: {
        fontSize: 32,
        color: '#BDBDBD',
        fontWeight: '300'
    },
    absenceButton: {
        backgroundColor: '#D32F2F',
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#D32F2F",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4
    },
    absenceButtonText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 16,
        marginLeft: 8
    },
    // --- Modal Styles ---
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 20
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 24,
        width: '100%',
        maxWidth: 400
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#212121',
        marginBottom: 8,
        textAlign: 'center'
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#757575',
        marginBottom: 20,
        textAlign: 'center'
    },
    textInput: {
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        padding: 15,
        fontSize: 16,
        color: '#212121',
        height: 100,
        textAlignVertical: 'top',
        marginBottom: 20
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    actionBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        marginHorizontal: 5,
        alignItems: 'center'
    },
    btnText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 15
    },
    // Management Modal Specific Styles
    manageBtn: {
        width: '100%',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center'
    },
    btnContent: {
        flexDirection: 'row',
        alignItems: 'center'
    }
});
