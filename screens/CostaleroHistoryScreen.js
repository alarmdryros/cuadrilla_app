import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../supabaseConfig';

export default function CostaleroHistoryScreen({ route, navigation }) {
    const { costaleroId, costaleroName } = route.params;
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        navigation.setOptions({ title: `Historial: ${costaleroName}` });

        const fetchHistory = async () => {
            try {
                // Efficient relational query
                const { data, error } = await supabase
                    .from('asistencias')
                    .select(`
                        id,
                        status,
                        timestamp,
                        eventos (
                            id,
                            nombre,
                            fecha
                        )
                    `)
                    .eq('costalero_id', costaleroId)
                    .order('timestamp', { ascending: false });

                if (error) throw error;

                // Flatten structure
                const historyList = (data || []).map(item => ({
                    id: item.id,
                    eventName: item.eventos?.nombre || 'Evento desconocido',
                    eventDate: item.eventos?.fecha,
                    timestamp: item.timestamp,
                    status: item.status
                }));

                setHistory(historyList);

            } catch (error) {
                console.error("Error fetching history: ", error);
                Alert.alert("Error", "No se pudo cargar el historial.");
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
                contentContainerStyle={{ paddingTop: 20, paddingBottom: 20 }}
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
