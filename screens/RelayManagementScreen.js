import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal, TextInput } from 'react-native';
import { collection, onSnapshot, query, addDoc, deleteDoc, doc, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export default function RelayManagementScreen({ route, navigation }) {
    const { eventId, eventName } = route.params;
    const [relevos, setRelevos] = useState([]);
    const [allCostaleros, setAllCostaleros] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedPosition, setSelectedPosition] = useState(null);
    const [showAllTrabajaderas, setShowAllTrabajaderas] = useState(false);

    // Relay Points State
    const [relayPoints, setRelayPoints] = useState([]);
    const [currentRelayPoint, setCurrentRelayPoint] = useState(null);
    const [newPointModalVisible, setNewPointModalVisible] = useState(false);
    const [newPointName, setNewPointName] = useState('');

    // Swap State
    const [swappingRelevo, setSwappingRelevo] = useState(null);

    // Definir estructura de posiciones por trabajadera
    const getPositions = (trabajadera) => {
        if (trabajadera === 1 || trabajadera === 7) {
            return ['patero1', 'patero2', 'fijador1', 'fijador2', 'corriente'];
        } else {
            return ['costero1', 'costero2', 'fijador1', 'fijador2', 'corriente'];
        }
    };

    const getPositionLabel = (position) => {
        const labels = {
            'patero1': 'Patero 1',
            'patero2': 'Patero 2',
            'costero1': 'Costero 1',
            'costero2': 'Costero 2',
            'fijador1': 'Fijador 1',
            'fijador2': 'Fijador 2',
            'corriente': 'Corriente'
        };
        return labels[position] || position;
    };

    useEffect(() => {
        navigation.setOptions({ title: `Gestión Relevos` });

        // Cargar todos los costaleros
        const loadCostaleros = async () => {
            const snapshot = await getDocs(collection(db, "costaleros"));
            const costalerosList = [];
            snapshot.forEach(doc => {
                costalerosList.push({ id: doc.id, ...doc.data() });
            });
            setAllCostaleros(costalerosList);
        };
        loadCostaleros();

        // 1. Escuchar Puntos de Relevo
        const pointsQuery = query(collection(db, "eventos", eventId, "relayPoints"), orderBy("createdAt", "asc"));
        const unsubscribePoints = onSnapshot(pointsQuery, (snapshot) => {
            const points = [];
            snapshot.forEach(doc => points.push({ id: doc.id, ...doc.data() }));
            setRelayPoints(points);

            // Auto-select first point if none selected
            if (points.length > 0 && !currentRelayPoint) {
                setCurrentRelayPoint(points[0]);
            }
        });

        // 2. Escuchar todos los relevos del evento
        const relevosQuery = query(collection(db, "eventos", eventId, "relevos"));
        const unsubscribeRelevos = onSnapshot(relevosQuery, (snapshot) => {
            const relevosList = [];
            snapshot.forEach(doc => {
                relevosList.push({ id: doc.id, ...doc.data() });
            });
            setRelevos(relevosList);
            setLoading(false);
        });

        return () => {
            unsubscribePoints();
            unsubscribeRelevos();
        };
    }, [eventId]);

    const createRelayPoint = async () => {
        if (!newPointName.trim()) return;
        try {
            await addDoc(collection(db, "eventos", eventId, "relayPoints"), {
                name: newPointName,
                createdAt: new Date()
            });
            setNewPointName('');
            setNewPointModalVisible(false);
        } catch (error) {
            Alert.alert('Error', error.message);
        }
    };

    const assignPosition = async (trabajadera, position, costaleroId) => {
        if (!currentRelayPoint) {
            Alert.alert("Atención", "Selecciona o crea un Punto de Relevo primero.");
            return;
        }

        const costalero = allCostaleros.find(c => c.id === costaleroId);
        if (!costalero) return;

        try {
            await addDoc(collection(db, "eventos", eventId, "relevos"), {
                trabajadera,
                posicion: position,
                costaleroId,
                nombreCostalero: `${costalero.nombre} ${costalero.apellidos}`,
                estado: 'activo',
                relayPointId: currentRelayPoint.id, // Link to current point
                timestamp: new Date()
            });
            setModalVisible(false);
            setShowAllTrabajaderas(false);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', error.message);
        }
    };

    const removeFromPosition = async (relevoId) => {
        Alert.alert(
            'Confirmar',
            '¿Quitar de esta posición?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Quitar',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteDoc(doc(db, "eventos", eventId, "relevos", relevoId));
                        } catch (error) {
                            Alert.alert('Error', error.message);
                        }
                    }
                }
            ]
        );
    };

    const getAssignedCostalero = (trabajadera, position) => {
        if (!currentRelayPoint) return null;
        return relevos.find(r =>
            r.trabajadera === trabajadera &&
            r.posicion === position &&
            r.estado === 'activo' &&
            r.relayPointId === currentRelayPoint.id
        );
    };

    const getAssignedIds = () => {
        if (!currentRelayPoint) return [];
        return relevos
            .filter(r => r.estado === 'activo' && r.relayPointId === currentRelayPoint.id)
            .map(r => r.costaleroId);
    };

    const getAvailableCostaleros = (trabajaderaFilter) => {
        const assignedIds = getAssignedIds();
        let available = allCostaleros.filter(c => !assignedIds.includes(c.id));

        // Filtrar por trabajadera si no se muestra todas
        if (!showAllTrabajaderas && trabajaderaFilter) {
            available = available.filter(c => String(c.trabajadera) === String(trabajaderaFilter));
        }

        return available;
    };



    // ... (rest of state)

    // ... (rest of functions)

    const handleSwap = async (targetRelevo, reserveCostalero) => {
        try {
            // Update the existing relevo document with the new costalero details
            await deleteDoc(doc(db, "eventos", eventId, "relevos", targetRelevo.id));

            // Add new doc with same position info but new costalero
            // We delete and add to ensure clean state, or we could update.
            // Let's use delete + add to keep consistency with "assignPosition" logic
            // actually, update is better to keep the ID, but for now delete+add is safer if structure changes
            // Wait, we want to swap.
            // B enters Position P.

            await addDoc(collection(db, "eventos", eventId, "relevos"), {
                trabajadera: targetRelevo.trabajadera,
                posicion: targetRelevo.posicion,
                costaleroId: reserveCostalero.id,
                nombreCostalero: `${reserveCostalero.nombre} ${reserveCostalero.apellidos}`,
                estado: 'activo',
                relayPointId: currentRelayPoint.id,
                timestamp: new Date()
            });

            setSwappingRelevo(null);
            Alert.alert('Cambio realizado', `${reserveCostalero.nombre} entra por ${targetRelevo.nombreCostalero}`);
        } catch (error) {
            Alert.alert('Error', error.message);
        }
    };

    const renderPosition = (trabajadera, position) => {
        const assigned = getAssignedCostalero(trabajadera, position);
        const isCorriente = position === 'corriente';
        const isSelectedForSwap = swappingRelevo && assigned && swappingRelevo.id === assigned.id;

        return (
            <TouchableOpacity
                key={position}
                style={[
                    styles.positionCard,
                    assigned && styles.positionCardFilled,
                    isCorriente && styles.positionCardCorriente,
                    isSelectedForSwap && styles.positionCardSelected
                ]}
                onPress={() => {
                    if (assigned) {
                        // Toggle selection for swap
                        if (swappingRelevo && swappingRelevo.id === assigned.id) {
                            setSwappingRelevo(null);
                        } else {
                            setSwappingRelevo(assigned);
                        }
                    } else {
                        setSelectedPosition({ trabajadera, position });
                        setShowAllTrabajaderas(false);
                        setModalVisible(true);
                    }
                }}
                onLongPress={() => {
                    if (assigned) removeFromPosition(assigned.id);
                }}
                delayLongPress={500}
            >
                <Text style={styles.positionLabel}>{getPositionLabel(position)}</Text>
                {assigned ? (
                    <Text style={styles.positionName}>{assigned.nombreCostalero}</Text>
                ) : (
                    <Text style={styles.positionEmpty}>Vacío</Text>
                )}
            </TouchableOpacity>
        );
    };

    const renderTrabajaderaSection = (trabajadera) => {
        const positions = getPositions(trabajadera);
        const title = trabajadera === 1 ? 'Primera' : trabajadera === 7 ? 'Última' : `Trabajadera ${trabajadera}`;

        // Separar corriente del resto
        const mainPositions = positions.filter(p => p !== 'corriente');
        const corrientePosition = positions.find(p => p === 'corriente');

        // Check if all positions are filled
        const filledPositions = positions.filter(p => getAssignedCostalero(trabajadera, p)).length;
        const allFilled = filledPositions === positions.length;

        // Get Reserves (unassigned costaleros for this trabajadera) only if all positions are filled
        let reserves = [];
        if (allFilled) {
            const assignedIds = getAssignedIds();
            reserves = allCostaleros.filter(c =>
                String(c.trabajadera) === String(trabajadera) &&
                !assignedIds.includes(c.id)
            );
        }

        return (
            <View key={trabajadera} style={styles.trabajaderaSection}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={styles.trabajaderaTitle}>{title}</Text>
                    {allFilled && (
                        <View style={styles.badgeSuccess}>
                            <Text style={styles.badgeText}>Completa</Text>
                        </View>
                    )}
                </View>

                {/* Posiciones principales (2x2) */}
                <View style={styles.positionsGrid}>
                    {mainPositions.map(position => renderPosition(trabajadera, position))}
                </View>

                {/* Corriente centrado */}
                {corrientePosition && (
                    <View style={styles.corrienteContainer}>
                        {renderPosition(trabajadera, corrientePosition)}
                    </View>
                )}

                {/* Reserves Section */}
                {allFilled && reserves.length > 0 && (
                    <View style={styles.reservesContainer}>
                        <Text style={styles.reservesTitle}>Reservas / Fuera del paso ({reserves.length})</Text>
                        <View style={styles.reservesList}>
                            {reserves.map(costalero => (
                                <TouchableOpacity
                                    key={costalero.id}
                                    style={[
                                        styles.reserveItem,
                                        swappingRelevo && styles.reserveItemActive // Visual cue that they are clickable
                                    ]}
                                    onPress={() => {
                                        if (swappingRelevo) {
                                            handleSwap(swappingRelevo, costalero);
                                        } else {
                                            // Optional: Show details or do nothing
                                        }
                                    }}
                                >
                                    <Text style={styles.reserveName}>
                                        {costalero.apellidos}, {costalero.nombre}
                                    </Text>
                                    <Text style={styles.reserveRole}>{costalero.puesto}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#5E35B1" />
            </View>
        );
    }

    const availableCostaleros = selectedPosition
        ? getAvailableCostaleros(selectedPosition.trabajadera)
        : [];
    const assignedCount = getAssignedIds().length;

    // UI Helpers
    const renderRelayPointTabs = () => (
        <View style={styles.pointsHeader}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                {relayPoints.map(point => (
                    <TouchableOpacity
                        key={point.id}
                        style={[
                            styles.pointTab,
                            currentRelayPoint?.id === point.id && styles.pointTabActive
                        ]}
                        onPress={() => setCurrentRelayPoint(point)}
                    >
                        <Text style={[
                            styles.pointTabText,
                            currentRelayPoint?.id === point.id && styles.pointTabTextActive
                        ]}>
                            {point.name}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
            <TouchableOpacity
                style={styles.addPointButton}
                onPress={() => setNewPointModalVisible(true)}
            >
                <Text style={styles.addPointButtonText}>+</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            {renderRelayPointTabs()}

            {!currentRelayPoint ? (
                <View style={styles.centerEmpty}>
                    <Text style={styles.emptyText}>Crea un punto de relevo para comenzar</Text>
                </View>
            ) : (
                <>
                    <View style={styles.header}>
                        <Text style={styles.headerText}>
                            {assignedCount}/35 posiciones ocupadas
                        </Text>
                        <Text style={styles.headerSubtext}>
                            {allCostaleros.length - assignedCount} disponibles
                        </Text>
                    </View>

                    <ScrollView style={styles.scrollView}>
                        {[1, 2, 3, 4, 5, 6, 7].map(t => renderTrabajaderaSection(t))}
                    </ScrollView>
                </>
            )}

            {/* Modal Crear Punto Relevo */}
            <Modal
                visible={newPointModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setNewPointModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Nuevo Punto de Relevo</Text>
                        <Text style={styles.modalSubtitle}>Ej: Salida, Carrera Oficial...</Text>

                        <TextInput
                            style={styles.input}
                            placeholder="Nombre del punto"
                            value={newPointName}
                            onChangeText={setNewPointName}
                            autoFocus
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.actionBtn, { backgroundColor: '#BDBDBD' }]}
                                onPress={() => setNewPointModalVisible(false)}
                            >
                                <Text style={styles.btnText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actionBtn, { backgroundColor: '#5E35B1' }]}
                                onPress={createRelayPoint}
                            >
                                <Text style={styles.btnText}>Crear</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal para seleccionar costalero */}
            <Modal
                visible={modalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => {
                    setModalVisible(false);
                    setShowAllTrabajaderas(false);
                }}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>
                            Seleccionar Costalero
                        </Text>
                        <Text style={styles.modalSubtitle}>
                            {selectedPosition && `${getPositionLabel(selectedPosition.position)} - Trabajadera ${selectedPosition.trabajadera}`}
                        </Text>

                        {/* Toggle para mostrar todas las trabajaderas */}
                        <TouchableOpacity
                            style={styles.toggleContainer}
                            onPress={() => setShowAllTrabajaderas(!showAllTrabajaderas)}
                        >
                            <View style={[styles.checkbox, showAllTrabajaderas && styles.checkboxChecked]}>
                                {showAllTrabajaderas && <Text style={styles.checkmark}>✓</Text>}
                            </View>
                            <Text style={styles.toggleText}>
                                Buscar en otras trabajaderas
                            </Text>
                        </TouchableOpacity>

                        <ScrollView style={styles.modalList}>
                            {availableCostaleros.length > 0 ? (
                                availableCostaleros.map(costalero => (
                                    <TouchableOpacity
                                        key={costalero.id}
                                        style={styles.costaleroItem}
                                        onPress={() => {
                                            if (selectedPosition) {
                                                assignPosition(
                                                    selectedPosition.trabajadera,
                                                    selectedPosition.position,
                                                    costalero.id
                                                );
                                            }
                                        }}
                                    >
                                        <Text style={styles.costaleroName}>
                                            {costalero.apellidos}, {costalero.nombre}
                                        </Text>
                                        <Text style={styles.costaleroInfo}>
                                            Trab. {costalero.trabajadera} • {costalero.puesto}
                                        </Text>
                                    </TouchableOpacity>
                                ))
                            ) : (
                                <Text style={styles.emptyText}>
                                    {showAllTrabajaderas
                                        ? 'No hay costaleros disponibles'
                                        : 'No hay costaleros de esta trabajadera disponibles.\nActiva "Buscar en otras trabajaderas"'}
                                </Text>
                            )}
                        </ScrollView>

                        <TouchableOpacity
                            style={styles.modalCloseButton}
                            onPress={() => {
                                setModalVisible(false);
                                setShowAllTrabajaderas(false);
                            }}
                        >
                            <Text style={styles.modalCloseText}>Cancelar</Text>
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
        backgroundColor: '#F3F4F6' // Cool Gray Background
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F3F4F6'
    },

    // --- Header ---
    header: {
        backgroundColor: '#4A148C', // Premium Purple
        paddingVertical: 16,
        paddingHorizontal: 20,
        alignItems: 'center',
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        shadowColor: "#4A148C",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
        zIndex: 10
    },
    headerText: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: '800',
        letterSpacing: 0.5
    },
    headerSubtext: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 14,
        marginTop: 4,
        fontWeight: '500'
    },

    // --- Relay Points Tabs ---
    pointsHeader: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB'
    },
    pointTab: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        marginRight: 10,
        borderWidth: 1,
        borderColor: 'transparent'
    },
    pointTabActive: {
        backgroundColor: '#4A148C',
        shadowColor: "#4A148C",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 4,
        elevation: 4
    },
    pointTabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280'
    },
    pointTabTextActive: {
        color: '#FFFFFF',
        fontWeight: '700'
    },
    addPointButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 4
    },
    addPointButtonText: {
        fontSize: 22,
        color: '#4A148C',
        marginTop: -2
    },

    // --- Scroll Area ---
    scrollView: {
        flex: 1,
        marginTop: -10, // Pull up to overlap slightly if we wanted, but let's keep clean
        paddingTop: 10
    },

    // --- Trabajadera Section ---
    trabajaderaSection: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 16,
        borderRadius: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#F9FAFB'
    },
    trabajaderaTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#111827',
        letterSpacing: -0.5
    },
    positionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 12
    },
    corrienteContainer: {
        alignItems: 'center',
        marginTop: 4
    },

    // --- Position Card ---
    positionCard: {
        width: '48%',
        backgroundColor: '#F9FAFB',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
        marginBottom: 10,
        borderStyle: 'dashed', // Dashed for empty
        minHeight: 70,
        justifyContent: 'center'
    },
    positionCardFilled: {
        backgroundColor: '#FFFFFF',
        borderStyle: 'solid',
        borderColor: '#E5E7EB',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2
    },
    positionCardCorriente: {
        width: '60%'
    },
    positionCardSelected: {
        borderColor: '#D4AF37', // Gold for selection
        backgroundColor: '#FFFBEB',
        borderWidth: 2,
        shadowColor: "#D4AF37",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 4
    },

    // Typography in Card
    positionLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#9CA3AF',
        textTransform: 'uppercase',
        marginBottom: 4,
        letterSpacing: 0.5
    },
    positionName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1F2937'
    },
    positionEmpty: {
        fontSize: 14,
        color: '#D1D5DB',
        fontWeight: '500'
    },

    // --- Badges ---
    badgeSuccess: {
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#10B981'
    },
    badgeText: {
        color: '#059669',
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase'
    },

    // --- Reserves Section ---
    reservesContainer: {
        marginTop: 12,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6'
    },
    reservesTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#6B7280',
        marginBottom: 10,
        textTransform: 'uppercase',
        letterSpacing: 1
    },
    reservesList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8
    },
    reserveItem: {
        backgroundColor: '#FEF3C7', // Soft Amber
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#FDE68A'
    },
    reserveItemActive: {
        backgroundColor: '#D1FAE5', // Greenish when ready to swap? Or reuse Gold.
        borderColor: '#10B981',
        borderWidth: 2
    },
    reserveName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#92400E' // Dark Amber
    },
    reserveRole: {
        fontSize: 11,
        color: '#B45309',
        marginTop: 1
    },

    // --- Empty States & Modals ---
    centerEmpty: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40
    },
    emptyText: {
        textAlign: 'center',
        color: '#6B7280',
        fontSize: 16,
        lineHeight: 24,
        fontWeight: '500'
    },

    // Modal
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)', // Darker dim
        justifyContent: 'center', // Center modal for creation
        padding: 20
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 24,
        padding: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 6
    },
    modalSubtitle: {
        fontSize: 15,
        color: '#6B7280',
        marginBottom: 24
    },
    input: {
        borderWidth: 2,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        fontSize: 16,
        backgroundColor: '#F9FAFB',
        color: '#111827'
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12
    },
    actionBtn: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 12
    },
    btnText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 16
    },

    // List Modal Specifics
    toggleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB'
    },
    checkbox: {
        width: 24,
        height: 24,
        borderWidth: 2,
        borderColor: '#4A148C',
        borderRadius: 6,
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'white'
    },
    checkboxChecked: {
        backgroundColor: '#4A148C'
    },
    checkmark: {
        color: 'white',
        fontSize: 14,
        fontWeight: '800'
    },
    toggleText: {
        fontSize: 15,
        color: '#374151',
        fontWeight: '600'
    },
    modalList: {
        maxHeight: 400
    },
    costaleroItem: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    costaleroName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827'
    },
    costaleroInfo: {
        fontSize: 13,
        color: '#6B7280',
        marginTop: 2
    },
    modalCloseButton: {
        backgroundColor: '#F3F4F6',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 16
    },
    modalCloseText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#4B5563'
    }
});
