import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { collectionGroup, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export default function CostaleroHistoryScreen({ route, navigation }) {
    const { costaleroId, costaleroName } = route.params;
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        navigation.setOptions({ title: `Historial: ${costaleroName}` });

        const fetchHistory = async () => {
            try {
                // Query all 'asistencias' subcollections where costaleroId matches
                // Note: This requires an index in Firestore usually.
                const q = query(
                    collectionGroup(db, 'asistencias'),
                    where('costaleroId', '==', costaleroId),
                    orderBy('timestamp', 'desc')
                );

                const querySnapshot = await getDocs(q);
                const historyList = [];

                // We need to fetch event details for each attendance record because 
                // the subcollection doc doesn't strictly contain the event Name unless we duplicated it.
                // Optimisation: Read parent doc.

                const promises = querySnapshot.docs.map(async (asistenciaDoc) => {
                    const asistenciaData = asistenciaDoc.data();

                    // Get parent Event doc
                    // asistenciaDoc.ref.parent -> 'asistencias' collection
                    // asistenciaDoc.ref.parent.parent -> Event document
                    const eventDocRef = asistenciaDoc.ref.parent.parent;

                    if (eventDocRef) {
                        const eventSnap = await getDoc(eventDocRef);
                        const eventData = eventSnap.exists() ? eventSnap.data() : { nombre: 'Evento Eliminado' };

                        return {
                            id: asistenciaDoc.id,
                            eventName: eventData.nombre,
                            eventDate: eventData.fecha,
                            ...asistenciaData
                        };
                    }
                    return null;
                });

                const results = await Promise.all(promises);
                setHistory(results.filter(r => r !== null));
            } catch (error) {
                console.error("Error fetching history: ", error);
                // Handle missing index error gracefully if possible, or just log
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [costaleroId]);

    const renderItem = ({ item }) => (
        <View style={[styles.item, getStatusStyle(item.status)]}>
            <Text style={styles.eventName}>{item.eventName}</Text>
            <Text style={styles.date}>📅 {new Date(item.eventDate || item.timestamp?.toDate()).toLocaleDateString()}</Text>
            <Text style={styles.status}>{getStatusText(item.status)}</Text>
        </View>
    );

    const getStatusStyle = (status) => {
        switch (status) {
            case 'presente': return styles.presente;
            case 'ausente': return styles.ausente;
            case 'justificado': return styles.justificado;
            default: return {};
        }
    };

    const getStatusText = (status) => {
        switch (status) {
            case 'presente': return "✅ Presente";
            case 'ausente': return "❌ Ausente";
            case 'justificado': return "📝 Justificado";
            default: return status;
        }
    };

    if (loading) return <ActivityIndicator style={styles.center} />;

    return (
        <View style={styles.container}>
            <FlatList
                data={history}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                ListEmptyComponent={<Text style={styles.empty}>No hay registros de asistencia.</Text>}
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
    item: {
        backgroundColor: 'white',
        padding: 18,
        marginBottom: 12,
        marginHorizontal: 16,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 3,
        borderLeftWidth: 4,
        borderLeftColor: '#E0E0E0'
    },
    presente: {
        borderLeftColor: '#4CAF50',
        backgroundColor: '#F1F8F4'
    },
    ausente: {
        borderLeftColor: '#F44336',
        backgroundColor: '#FEF5F5'
    },
    justificado: {
        borderLeftColor: '#FF9800',
        backgroundColor: '#FFF8F0'
    },
    name: {
        fontSize: 17,
        fontWeight: '700',
        color: '#212121',
        marginBottom: 6
    },
    time: {
        color: '#757575',
        fontSize: 14,
        marginTop: 4,
        fontWeight: '500'
    },
    arrow: {
        fontSize: 24,
        color: '#BDBDBD',
        fontWeight: '300'
    },
    empty: {
        textAlign: 'center',
        marginTop: 80,
        color: '#9E9E9E',
        fontSize: 16,
        paddingHorizontal: 40
    }
});
