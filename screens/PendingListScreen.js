import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '../components/Icon';
import { supabase } from '../supabaseConfig';
import { useAuth } from '../contexts/AuthContext';

export default function PendingListScreen({ route, navigation }) {
    const { userRole } = useAuth();
    const { eventId, eventName } = route.params || {};

    const isManagement = userRole === 'admin' || userRole === 'capataz';

    const [ausentesList, setAusentesList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [managementModalVisible, setManagementModalVisible] = useState(false);
    const [selectedCostalero, setSelectedCostalero] = useState(null);

    const fetchPendingCostaleros = async () => {
        if (!eventId) return;

        try {
            setLoading(true);

            // 1. Get Event Details to know the year
            const { data: eventData, error: eventError } = await supabase
                .from('eventos')
                .select('año')
                .eq('id', eventId)
                .single();

            if (eventError) throw eventError;

            // 2. Get costaleros for this year only
            const { data: costalerosData, error: costalerosError } = await supabase
                .from('costaleros')
                .select('*')
                .eq('año', eventData.año)
                .order('apellidos');

            if (costalerosError) throw costalerosError;

            // Get asistencias for this event
            const { data: asisData, error: asisError } = await supabase
                .from('asistencias')
                .select('*')
                .eq('event_id', eventId);

            if (asisError) throw asisError;

            // Filter out costaleros who already have attendance
            const presentIds = new Set((asisData || []).map(a => a.costalero_id || a.costaleroId));
            const pendingList = (costalerosData || [])
                .filter(c => !presentIds.has(c.id))
                .sort((a, b) => {
                    const tA = a.trabajadera ? parseInt(a.trabajadera) : 999;
                    const tB = b.trabajadera ? parseInt(b.trabajadera) : 999;
                    if (tA !== tB) return tA - tB;
                    return (a.apellidos || '').localeCompare(b.apellidos || '');
                });

            setAusentesList(pendingList);
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "No se pudieron cargar los costaleros pendientes");
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchPendingCostaleros();
        }, [eventId])
    );

    React.useLayoutEffect(() => {
        navigation.setOptions({
            title: eventName ? `Pendientes - ${eventName}` : 'Pendientes'
        });
    }, [navigation, eventName]);

    const addAsistencia = async (costalero, status) => {
        if (!isManagement) return;
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
                    status: status // 'presente' | 'justificado' | 'ausente'
                }]);

            if (insertError) throw insertError;
            Alert.alert("Actualizado", `Costalero marcado como ${status}`);
            fetchPendingCostaleros();
        } catch (e) {
            Alert.alert("Error", e.message);
        }
    };

    const handleManualAction = (costalero) => {
        if (!isManagement) return;
        setSelectedCostalero(costalero);
        setManagementModalVisible(true);
    };

    const getBadgeStyles = () => {
        return { bg: '#F5F5F5', border: '#9E9E9E', text: '#616161' }; // pendiente style
    };

    const renderAusente = ({ item }) => {
        const { bg, border, text } = getBadgeStyles();
        return (
            <View style={styles.item}>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => handleManualAction(item)}>
                    <View style={styles.nameRow}>
                        <Text style={styles.name}>{item.apellidos}, {item.nombre}</Text>
                        {item.trabajadera && (
                            <View style={[styles.badge, { backgroundColor: bg, borderColor: border }]}>
                                <Text style={[styles.badgeText, { color: text }]}>T{item.trabajadera}</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.time}>⏳ Pendiente - Toca para opciones</Text>
                </TouchableOpacity>

            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#5E35B1" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerText}>Total: {ausentesList.length} pendientes</Text>
                <Text style={styles.subHeaderText}>Costaleros sin asistencia registrada</Text>
            </View>

            <FlatList
                data={ausentesList}
                renderItem={renderAusente}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                ListEmptyComponent={<Text style={styles.empty}>¡Todos los costaleros han sido registrados!</Text>}
            />

            {/* Modal de Gestión de Asistencia */}
            <Modal
                visible={managementModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setManagementModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Gestionar Asistencia</Text>
                        <Text style={styles.modalSubtitle}>
                            {selectedCostalero?.nombre} {selectedCostalero?.apellidos}
                        </Text>

                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: '#4CAF50', marginBottom: 12 }]}
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
                            style={[styles.actionBtn, { backgroundColor: '#FF9800', marginBottom: 12 }]}
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
                            style={[styles.actionBtn, { backgroundColor: '#F44336', marginBottom: 24 }]}
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
                            style={[styles.actionBtn, { backgroundColor: '#BDBDBD' }]}
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
        padding: 16,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    headerText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#212121',
        textAlign: 'center',
        marginBottom: 4
    },
    subHeaderText: {
        fontSize: 13,
        color: '#757575',
        textAlign: 'center'
    },
    list: {
        padding: 12,
        paddingBottom: 100
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
    empty: {
        textAlign: 'center',
        marginTop: 60,
        color: '#9E9E9E',
        fontSize: 16
    },
    // Modal Styles
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
        fontSize: 16,
        color: '#5E35B1',
        fontWeight: '600',
        marginBottom: 24,
        textAlign: 'center'
    },
    actionBtn: {
        width: '100%',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center'
    },
    btnContent: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    btnText: {
        color: 'white',
        fontWeight: '800',
        fontSize: 15,
        marginLeft: 10
    }
});
