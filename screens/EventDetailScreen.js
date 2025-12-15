import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Button, ActivityIndicator, TouchableOpacity, Alert, ScrollView, Linking } from 'react-native';
import { doc, getDoc, collection, onSnapshot, query, orderBy, getDocs, addDoc, serverTimestamp, deleteDoc, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';

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
                            await deleteDoc(doc(db, "eventos", eventId));
                            // Optional: Delete subcollections logic here if needed, 
                            // but for now we rely on logical deletion.
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

    useEffect(() => {
        if (!eventId) return;

        const fetchData = async () => {
            // 1. Get Event Details
            const eventRef = doc(db, "eventos", eventId);
            const unsubscribeEvent = onSnapshot(eventRef, (docSnap) => {
                if (docSnap.exists()) {
                    setEvent(docSnap.data());
                    navigation.setOptions({ title: docSnap.data().nombre });
                    // Check if event is finished
                    const now = new Date();
                    const end = new Date(docSnap.data().fechaFin);
                    if (now > end) {
                        setIsEventFinished(true);
                    }
                } else {
                    // Document deleted
                    // navigation.goBack(); // Handled by delete action usually
                }
            });
            // ... (rest of fetch logic moved or adapted below)
            return () => unsubscribeEvent();
        };

        // We split the effect to handle async cleaner
        fetchData();

        // 2. Get All Costaleros
        const fetchCostaleros = async () => {
            const costalerosSnap = await getDocs(query(collection(db, "costaleros"), orderBy("apellidos")));
            const costalerosList = [];
            costalerosSnap.forEach(doc => costalerosList.push({ id: doc.id, ...doc.data() }));
            setAllCostaleros(costalerosList);
        };
        fetchCostaleros();

        // 3. Listen to Asistencias
        const q = query(collection(db, "eventos", eventId, "asistencias"), orderBy("timestamp", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = [];
            snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
            setAsistencias(list);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [eventId]);

    // Calculate lists
    const presentIds = new Set(asistencias.map(a => a.costaleroId));
    const ausentesList = allCostaleros.filter(c => !presentIds.has(c.id));

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
        let count = 0;
        try {
            const batchPromises = ausentesList.map(costalero => {
                count++;
                return addDoc(collection(db, "eventos", eventId, "asistencias"), {
                    costaleroId: costalero.id,
                    nombreCostalero: `${costalero.nombre} ${costalero.apellidos}`,
                    timestamp: serverTimestamp(),
                    status: 'ausente'
                });
            });
            await Promise.all(batchPromises);
            Alert.alert("Evento Cerrado", `Se han marcado ${count} ausencias automáticamente.`);
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Hubo un problema cerrando el acta.");
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
            await deleteDoc(doc(db, "eventos", eventId, "asistencias", attendanceId));
            Alert.alert("Eliminado", "Asistencia eliminada. El costalero vuelve a estar 'Ausente'.");
        } catch (e) {
            Alert.alert("Error", e.message);
        }
    };

    const addAsistencia = async (costalero, status) => {
        try {
            // Check if already registered
            const q = query(
                collection(db, "eventos", eventId, "asistencias"),
                where("costaleroId", "==", costalero.id)
            );
            const existingSnap = await getDocs(q);

            if (!existingSnap.empty) {
                const existingDoc = existingSnap.docs[0].data();
                const statusText = existingDoc.status === 'presente' ? 'PRESENTE' :
                    existingDoc.status === 'justificado' ? 'JUSTIFICADO' : 'AUSENTE';
                Alert.alert("Ya registrado", `Este costalero ya está marcado como: ${statusText}`);
                return;
            }

            // Add new attendance record
            await addDoc(collection(db, "eventos", eventId, "asistencias"), {
                costaleroId: costalero.id,
                nombreCostalero: `${costalero.nombre} ${costalero.apellidos}`,
                timestamp: serverTimestamp(),
                status: status // 'presente' | 'justificado'
            });
            Alert.alert("Actualizado", `Costalero marcado como ${status}`);
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
                    {item.status === 'justificado' ? '📝 FALTA JUSTIFICADA' : `🕒 ${item.timestamp?.toDate ? new Date(item.timestamp.toDate()).toLocaleTimeString() : ''}`}
                </Text>
            </View>
            <Text style={styles.arrow}>⋮</Text>
        </TouchableOpacity>
    );

    const renderAusente = ({ item }) => (
        <TouchableOpacity style={styles.item} onPress={() => handleManualAction(item)}>
            <View>
                <Text style={styles.name}>{item.apellidos}, {item.nombre}</Text>
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
