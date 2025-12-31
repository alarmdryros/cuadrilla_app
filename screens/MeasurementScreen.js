import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, SectionList, ActivityIndicator, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../supabaseConfig';
import { useAuth } from '../contexts/AuthContext';
import { MaterialIcons } from '../components/Icon';

export default function MeasurementScreen({ route, navigation }) {
    const { eventId, eventName } = route.params;
    const { userRole } = useAuth();
    const isManagement = userRole === 'admin' || userRole === 'capataz';

    const [sections, setSections] = useState([]);
    const [asistencias, setAsistencias] = useState([]);
    const [loading, setLoading] = useState(true);
    const [allCostaleros, setAllCostaleros] = useState([]);

    const fetchData = async () => {
        try {
            // Load all costaleros to get trabajadera info
            const { data: costalerosData, error: costError } = await supabase
                .from('costaleros')
                .select('*')
                .order('apellidos');

            if (costError) throw costError;
            setAllCostaleros(costalerosData || []);

            // Load asistencias
            const { data: asistenciasData, error: asisError } = await supabase
                .from('asistencias')
                .select('*')
                .eq('event_id', eventId)
                .order('timestamp', { ascending: false });

            if (asisError) throw asisError;

            // Filter and map asistencias
            const asistenciasList = (asistenciasData || [])
                .filter(data => data.status === 'presente') // Only measure present people
                .map(data => ({
                    ...data,
                    costaleroId: data.costalero_id,
                    alturaAntes: data.altura_antes,
                    alturaDespues: data.altura_despues
                }));

            setAsistencias(asistenciasList);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            navigation.setOptions({ title: `Mediciones - ${eventName}` });
            fetchData();
        }, [eventId, eventName])
    );

    useEffect(() => {
        if (allCostaleros.length > 0) {
            organizeSections(asistencias);
        }
    }, [asistencias, allCostaleros]);

    const organizeSections = (dataList) => {
        const costaleroMap = {};
        allCostaleros.forEach(c => {
            costaleroMap[c.id] = c.trabajadera || '0';
        });

        const grouped = {
            '1': [], '2': [], '3': [], '4': [], '5': [], '6': [], '7': [], '0': []
        };

        dataList.forEach(item => {
            const trabajadera = costaleroMap[item.costaleroId] || '0';
            if (grouped[trabajadera]) {
                grouped[trabajadera].push(item);
            } else {
                if (!grouped['0']) grouped['0'] = [];
                grouped['0'].push(item);
            }
        });

        const result = [];
        for (let i = 1; i <= 7; i++) {
            const key = i.toString();
            if (grouped[key] && grouped[key].length > 0) {
                result.push({
                    title: `Trabajadera ${i}`,
                    data: grouped[key],
                });
            }
        }
        if (grouped['0'] && grouped['0'].length > 0) {
            result.push({
                title: 'Sin Asignar',
                data: grouped['0'],
            });
        }
        setSections(result);
    };

    const updateMeasurement = async (attendanceId, field, value) => {
        if (!isManagement) return;
        try {
            // Map camelCase field to snake_case column
            const dbField = field === 'alturaAntes' ? 'altura_antes' : 'altura_despues';

            // Sanitize value: replace comma with dot and parse as float
            const cleanValue = value ? parseFloat(String(value).replace(/,/g, '.')) : null;
            if (value && isNaN(cleanValue)) {
                Alert.alert("Error", "Introduce un número válido");
                return;
            }

            const { error } = await supabase
                .from('asistencias')
                .update({
                    [dbField]: cleanValue
                })
                .eq('id', attendanceId);

            if (error) throw error;
            fetchData(); // Refresh to ensure UI is in sync
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "No se pudo guardar la medición");
        }
    };

    const confirmClear = (attendanceId, name) => {
        if (!isManagement) return;
        Alert.alert(
            "Borrar Mediciones",
            `¿Estás seguro de borrar las medidas de ${name}?`,
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Sí, borrar",
                    style: "destructive",
                    onPress: async () => {
                        const { error } = await supabase
                            .from('asistencias')
                            .update({ altura_antes: null, altura_despues: null })
                            .eq('id', attendanceId);
                        if (error) Alert.alert("Error", error.message);
                        else fetchData();
                    }
                }
            ]
        );
    };

    const confirmSave = (attendanceId, field, value, name) => {
        if (!isManagement) return;
        if (!value) return;

        const label = field === 'alturaAntes' ? 'ANTES' : 'DESPUÉS';
        Alert.alert(
            "Validar Medida",
            `¿Registrar ${value} cm como altura ${label} para ${name}?`,
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Validar",
                    onPress: () => updateMeasurement(attendanceId, field, value)
                }
            ]
        );
    };

    const renderItem = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <Text style={styles.name}>{item.nombreCostalero}</Text>
                {isManagement && (
                    <TouchableOpacity onPress={() => confirmClear(item.id, item.nombreCostalero)}>
                        <MaterialIcons name="delete-sweep" size={24} color="#D32F2F" />
                    </TouchableOpacity>
                )}
            </View>

            <View style={styles.measureRow}>
                <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Altura ANTES</Text>
                    <TextInput
                        style={[styles.input, !isManagement && styles.disabledInput]}
                        placeholder="cm"
                        keyboardType="numeric"
                        editable={isManagement}
                        defaultValue={item.alturaAntes ? String(item.alturaAntes) : ''}
                        onEndEditing={(e) => {
                            if (e.nativeEvent.text !== (item.alturaAntes ? String(item.alturaAntes) : '')) {
                                confirmSave(item.id, 'alturaAntes', e.nativeEvent.text, item.nombreCostalero);
                            }
                        }}
                    />
                </View>

                <View style={styles.divider} />

                <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Altura DESPUÉS</Text>
                    <TextInput
                        style={[styles.input, !isManagement && styles.disabledInput]}
                        placeholder="cm"
                        keyboardType="numeric"
                        editable={isManagement}
                        defaultValue={item.alturaDespues ? String(item.alturaDespues) : ''}
                        onEndEditing={(e) => {
                            if (e.nativeEvent.text !== (item.alturaDespues ? String(item.alturaDespues) : '')) {
                                confirmSave(item.id, 'alturaDespues', e.nativeEvent.text, item.nombreCostalero);
                            }
                        }}
                    />
                </View>
            </View>
        </View>
    );

    const renderSectionHeader = ({ section }) => (
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionCount}>{section.data.length} costaleros</Text>
        </View>
    );

    if (loading) return <ActivityIndicator style={styles.center} size="large" color="#5E35B1" />;

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.container}
        >
            <SectionList
                sections={sections}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                renderSectionHeader={renderSectionHeader}
                contentContainerStyle={styles.list}
                stickySectionHeadersEnabled={false}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <MaterialIcons name="person-off" size={64} color="#BDBDBD" />
                        <Text style={styles.emptyText}>No hay costaleros confirmados (Presentes) aún.</Text>
                    </View>
                }
            />
        </KeyboardAvoidingView>
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
    list: {
        padding: 16,
        paddingBottom: 40
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 10,
        paddingHorizontal: 4
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#5E35B1'
    },
    sectionCount: {
        fontSize: 14,
        color: '#757575'
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    cardHeader: {
        marginBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
        paddingBottom: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    name: {
        fontSize: 16,
        fontWeight: '600',
        color: '#212121',
        flex: 1
    },
    disabledInput: {
        backgroundColor: '#EEEEEE',
        color: '#9E9E9E',
        borderColor: '#E0E0E0'
    },
    measureRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    inputContainer: {
        flex: 1,
        alignItems: 'center'
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#757575',
        marginBottom: 8,
        textTransform: 'uppercase'
    },
    input: {
        backgroundColor: '#F5F5F5',
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 16,
        width: '80%',
        textAlign: 'center',
        fontSize: 18,
        fontWeight: '700',
        color: '#5E35B1',
        borderWidth: 1,
        borderColor: '#E0E0E0'
    },
    divider: {
        width: 1,
        height: '80%',
        backgroundColor: '#EEEEEE',
        marginHorizontal: 10
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 100
    },
    emptyText: {
        marginTop: 20,
        color: '#9E9E9E',
        fontSize: 16,
        textAlign: 'center'
    }
});
