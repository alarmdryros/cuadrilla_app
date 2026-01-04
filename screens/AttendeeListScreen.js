import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, SectionList, ActivityIndicator, TouchableOpacity, Alert, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../supabaseConfig';
import { useAuth } from '../contexts/AuthContext';
import { useOffline } from '../contexts/OfflineContext';
import { MaterialIcons } from '../components/Icon';

export default function AttendeeListScreen({ route, navigation }) {
    const { userRole } = useAuth();
    const { eventId, eventName } = route.params || {};

    const isManagement = ['superadmin', 'admin', 'capataz', 'auxiliar'].includes(userRole?.toLowerCase());

    const [sections, setSections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [managementModalVisible, setManagementModalVisible] = useState(false);
    const [selectedCostalero, setSelectedCostalero] = useState(null);
    const { isOffline, isSyncing, queueSize, addMutation } = useOffline();

    const fetchAsistencias = async () => {
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
                .eq('año', eventData.año);

            if (costalerosError) throw costalerosError;

            const costaleroMap = (costalerosData || []).reduce((acc, c) => {
                acc[c.id] = c;
                return acc;
            }, {});

            // 3. Get Asistencias for this event
            const { data: asisData, error: asisError } = await supabase
                .from('asistencias')
                .select('*')
                .eq('event_id', eventId)
                .order('timestamp', { ascending: false });

            if (asisError) throw asisError;

            // Deduplicate: If there are multiple records for the same costalero, keep the most recent one
            const uniqueAsisMap = (asisData || []).reduce((acc, a) => {
                const cId = a.costalero_id || a.costaleroId;
                if (!acc[cId] || new Date(a.timestamp) > new Date(acc[cId].timestamp)) {
                    acc[cId] = a;
                }
                return acc;
            }, {});
            const uniqueAsisData = Object.values(uniqueAsisMap);

            // Enrich and sort asistencias
            const processedAsistencias = uniqueAsisData.map(a => {
                const costalero = costaleroMap[a.costalero_id || a.costaleroId];
                return {
                    ...a,
                    trabajadera: costalero ? costalero.trabajadera : null,
                    apellidos: costalero ? costalero.apellidos : '',
                    suplemento: costalero ? costalero.suplemento : null
                };
            }).sort((a, b) => {
                const tA = a.trabajadera ? parseInt(a.trabajadera) : 999;
                const tB = b.trabajadera ? parseInt(b.trabajadera) : 999;
                if (tA !== tB) return tA - tB;
                return (a.nombreCostalero || '').localeCompare(b.nombreCostalero || '');
            });

            // Group into sections
            const grouped = processedAsistencias.reduce((acc, item) => {
                const trab = item.trabajadera ? (item.trabajadera === '0' ? 'Pendientes/Otros' : `Trabajadera ${item.trabajadera}`) : 'Sin Trabajadera';
                if (!acc[trab]) acc[trab] = [];
                acc[trab].push(item);
                return acc;
            }, {});

            const sectionsData = Object.keys(grouped).map(key => ({
                title: key,
                data: grouped[key]
            })).sort((a, b) => {
                const getNum = (s) => {
                    const m = s.match(/\d+/);
                    return m ? parseInt(m[0]) : 999;
                };
                return getNum(a.title) - getNum(b.title);
            });

            setSections(sectionsData);
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "No se pudieron cargar las asistencias");
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchAsistencias();
        }, [eventId])
    );

    React.useLayoutEffect(() => {
        navigation.setOptions({
            title: eventName ? `Asistentes - ${eventName}` : 'Asistentes'
        });
    }, [navigation, eventName]);

    const updateAsistencia = async (costalero, status) => {
        if (!isManagement) return;
        try {
            const newData = {
                event_id: eventId,
                costalero_id: costalero.costalero_id || costalero.costaleroId,
                nombreCostalero: costalero.nombreCostalero,
                timestamp: new Date().toISOString(),
                status: status
            };

            if (isOffline) {
                await addMutation({
                    table: 'asistencias',
                    type: 'upsert',
                    id: costalero.id || `${eventId}-${newData.costalero_id}`,
                    data: newData
                });
                Alert.alert("Guardado Offline", "El cambio se sincronizará cuando vuelvas a tener internet.");
                fetchAsistencias();
                return;
            }

            const { error } = await supabase
                .from('asistencias')
                .upsert([
                    {
                        id: costalero.id,
                        ...newData
                    }
                ]);

            if (error) throw error;
            Alert.alert("Actualizado", `Estado cambiado a ${status.toUpperCase()}`);
            fetchAsistencias();
        } catch (e) {
            Alert.alert("Error", e.message);
        }
    };

    const deleteAsistencia = async (attendanceId) => {
        if (!isManagement) return;
        try {
            if (isOffline) {
                Alert.alert("Offline", "La eliminación de asistencias requiere conexión.");
                return;
            }
            const { error } = await supabase
                .from('asistencias')
                .delete()
                .eq('id', attendanceId);

            if (error) throw error;
            Alert.alert("Eliminado", "Asistencia eliminada. El costalero vuelve a estar 'Pendiente'.");
            fetchAsistencias();
        } catch (e) {
            Alert.alert("Error", e.message);
        }
    };

    const getPresentCount = () => {
        return sections.reduce((acc, section) =>
            acc + section.data.filter(a => a.status === 'presente').length, 0);
    };

    const getJustifiedCount = () => {
        return sections.reduce((acc, section) =>
            acc + section.data.filter(a => a.status === 'justificado').length, 0);
    };

    const getAbsentCount = () => {
        return sections.reduce((acc, section) =>
            acc + section.data.filter(a => a.status === 'ausente').length, 0);
    };

    const getTotalCount = () => {
        return sections.reduce((acc, section) => acc + section.data.length, 0);
    };

    const handleExistingAction = (item) => {
        if (!isManagement) return;
        setSelectedCostalero(item);
        setManagementModalVisible(true);
    };

    const getBadgeStyles = (status) => {
        switch (status) {
            case 'presente': return { bg: '#E8F5E9', border: '#4CAF50', text: '#2E7D32' };
            case 'justificado': return { bg: '#FFF3E0', border: '#FF9800', text: '#EF6C00' };
            case 'ausente': return { bg: '#FFEBEE', border: '#F44336', text: '#C62828' };
            default: return { bg: '#F5F5F5', border: '#9E9E9E', text: '#616161' };
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
                        {!!item.trabajadera && (
                            <View style={[styles.badge, { backgroundColor: bg, borderColor: border }]}>
                                <Text style={[styles.badgeText, { color: text }]}>T{item.trabajadera}</Text>
                            </View>
                        )}
                        {!!item.suplemento && (
                            <Text style={styles.suplementoText}>({item.suplemento} cm)</Text>
                        )}
                    </View>
                    <Text style={styles.time}>
                        {item.status === 'justificado' ? '📝 FALTA JUSTIFICADA' :
                            item.status === 'ausente' ? '❌ NO ASISTE' :
                                `🕒 ${item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}`}
                    </Text>
                </View>
                <Text style={styles.arrow}>⋮</Text>
            </TouchableOpacity>
        );
    };

    const renderSectionHeader = ({ section: { title, data } }) => (
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <Text style={styles.sectionBadge}>{data.length} pers.</Text>
        </View>
    );

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
                <Text style={styles.headerText}>Total: {getTotalCount()} asistentes</Text>
                <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                        <Text style={styles.statNumber}>{getPresentCount()}</Text>
                        <Text style={styles.statLabel}>Presentes</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={[styles.statNumber, { color: 'orange' }]}>{getJustifiedCount()}</Text>
                        <Text style={styles.statLabel}>Justif.</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={[styles.statNumber, { color: 'red' }]}>{getAbsentCount()}</Text>
                        <Text style={styles.statLabel}>Ausentes</Text>
                    </View>
                </View>
            </View>

            {isOffline && (
                <View style={styles.offlineBanner}>
                    <MaterialIcons name="cloud-off" size={16} color="#B91C1C" />
                    <Text style={styles.offlineText}>Modo Offline Activo</Text>
                    {queueSize > 0 && <Text style={styles.queueText}>({queueSize} cambios pendientes)</Text>}
                </View>
            )}

            {isSyncing && (
                <View style={[styles.offlineBanner, { backgroundColor: '#DBEAFE' }]}>
                    <MaterialIcons name="sync" size={16} color="#1E40AF" />
                    <Text style={[styles.offlineText, { color: '#1E40AF' }]}>Sincronizando datos...</Text>
                </View>
            )}

            <SectionList
                sections={sections}
                renderItem={renderAsistente}
                renderSectionHeader={renderSectionHeader}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                stickySectionHeadersEnabled={true}
                ListEmptyComponent={<Text style={styles.empty}>No hay asistentes registrados.</Text>}
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
                            {selectedCostalero?.nombreCostalero}
                        </Text>

                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: '#4CAF50', marginBottom: 12 }]}
                            onPress={() => {
                                updateAsistencia(selectedCostalero, 'presente');
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
                                updateAsistencia(selectedCostalero, 'justificado');
                                setManagementModalVisible(false);
                            }}
                        >
                            <View style={styles.btnContent}>
                                <MaterialIcons name="event-available" size={24} color="white" />
                                <Text style={styles.btnText}>JUSTIFICAR FALTA</Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: '#F44336', marginBottom: 12 }]}
                            onPress={() => {
                                updateAsistencia(selectedCostalero, 'ausente');
                                setManagementModalVisible(false);
                            }}
                        >
                            <View style={styles.btnContent}>
                                <MaterialIcons name="cancel" size={24} color="white" />
                                <Text style={styles.btnText}>MARCAR AUSENTE</Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: '#D32F2F', marginBottom: 24 }]}
                            onPress={() => {
                                Alert.alert(
                                    "Eliminar Registro",
                                    "¿Estás seguro de que quieres eliminar esta asistencia por completo?",
                                    [
                                        { text: "Cancelar", style: "cancel" },
                                        {
                                            text: "Eliminar",
                                            style: 'destructive',
                                            onPress: () => {
                                                deleteAsistencia(selectedCostalero.id);
                                                setManagementModalVisible(false);
                                            }
                                        }
                                    ]
                                );
                            }}
                        >
                            <View style={styles.btnContent}>
                                <MaterialIcons name="delete" size={24} color="white" />
                                <Text style={styles.btnText}>ELIMINAR ASISTENCIA</Text>
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
        marginBottom: 12
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around'
    },
    statBox: {
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 10,
        minWidth: 70
    },
    statNumber: {
        fontSize: 20,
        fontWeight: '700',
        color: '#4CAF50'
    },
    statLabel: {
        fontSize: 11,
        color: '#757575',
        marginTop: 2,
        fontWeight: '500'
    },
    list: {
        paddingBottom: 100
    },
    sectionHeader: {
        backgroundColor: '#F5F5F5',
        paddingVertical: 10,
        paddingHorizontal: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#616161',
        letterSpacing: 0.5,
        textTransform: 'uppercase'
    },
    sectionBadge: {
        fontSize: 12,
        color: '#9E9E9E',
        fontWeight: '600'
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
        borderLeftColor: '#4CAF50'
    },
    ausenteItem: {
        borderLeftWidth: 4,
        borderLeftColor: '#F44336'
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
    suplementoText: {
        fontSize: 12,
        color: '#7B1FA2',
        fontWeight: '600',
        marginLeft: 4,
        fontStyle: 'italic'
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
    },
    // Offline Styles
    offlineBanner: {
        backgroundColor: '#FEE2E2',
        paddingVertical: 6,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#FECACA'
    },
    offlineText: {
        color: '#B91C1C',
        fontSize: 12,
        fontWeight: '700',
        marginLeft: 8
    },
    queueText: {
        color: '#B91C1C',
        fontSize: 11,
        marginLeft: 4,
        fontWeight: '500'
    }
});
