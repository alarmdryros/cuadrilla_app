import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView, Modal, TextInput } from 'react-native';
import { supabase } from '../supabaseConfig';
import { useSeason } from '../contexts/SeasonContext';
import { MaterialIcons } from '../components/Icon';

export default function SeasonManagementScreen({ navigation }) {
    const { currentYear, availableYears, refreshSeasons, changeSelectedYear } = useSeason();
    const [loading, setLoading] = useState(false);
    const [historyModalVisible, setHistoryModalVisible] = useState(false);
    const [historyYear, setHistoryYear] = useState('');
    const [cloneYear, setCloneYear] = useState(String(currentYear));

    const startNewSeason = async () => {
        const nextYear = currentYear + 1;

        Alert.alert(
            "🚀 Iniciar Nueva Temporada",
            `¿Estás seguro de que quieres iniciar la temporada ${nextYear}?\n\nSe copiarán todos los costaleros de ${currentYear} a ${nextYear}. Los eventos y asistencias comenzarán desde cero.`,
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Sí, Iniciar",
                    onPress: async () => {
                        setLoading(true);
                        try {
                            // 1. Obtener costaleros del año actual
                            const { data: costaleros, error: fetchError } = await supabase
                                .from('costaleros')
                                .select('*')
                                .eq('año', currentYear);

                            if (fetchError) throw fetchError;

                            if (costaleros && costaleros.length > 0) {
                                // 2. Preparar nuevas copias (borrando el ID original para que Supabase genere uno nuevo)
                                const newCostaleros = costaleros.map(c => {
                                    const { id, createdAt, updatedAt, ...rest } = c;
                                    return {
                                        ...rest,
                                        año: nextYear,
                                        createdAt: new Date().toISOString(),
                                        updatedAt: new Date().toISOString()
                                    };
                                });

                                // 3. Insertar en bloque
                                const { error: insertError } = await supabase
                                    .from('costaleros')
                                    .insert(newCostaleros);

                                if (insertError) throw insertError;
                            }

                            // 4. Actualizar configuración global
                            const { error: configError } = await supabase
                                .from('configuracion')
                                .upsert({ key: 'año_actual', value: String(nextYear) });

                            if (configError) throw configError;

                            Alert.alert("✅ Éxito", `Temporada ${nextYear} iniciada correctamente.`);
                            await refreshSeasons();
                            changeSelectedYear(nextYear);
                            navigation.goBack();

                        } catch (error) {
                            console.error(error);
                            Alert.alert("Error", "No se pudo iniciar la nueva temporada: " + error.message);
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const createHistoricalSeason = async () => {
        const yearInt = parseInt(historyYear);
        if (!yearInt || isNaN(yearInt)) {
            Alert.alert("Error", "Por favor, introduce un año válido.");
            return;
        }

        if (availableYears.includes(yearInt)) {
            Alert.alert("Atención", "Ese año ya existe en el histórico.");
            return;
        }

        setLoading(true);
        try {
            // 1. Obtener costaleros del año de origen (cloneYear)
            const { data: costaleros, error: fetchError } = await supabase
                .from('costaleros')
                .select('*')
                .eq('año', parseInt(cloneYear));

            if (fetchError) throw fetchError;

            if (costaleros && costaleros.length > 0) {
                // 2. Preparar nuevas copias
                const newCostaleros = costaleros.map(c => {
                    const { id, createdAt, updatedAt, ...rest } = c;
                    return {
                        ...rest,
                        año: yearInt,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                });

                // 3. Insertar
                const { error: insertError } = await supabase
                    .from('costaleros')
                    .insert(newCostaleros);

                if (insertError) throw insertError;
            }

            Alert.alert("✅ Éxito", `Temporada ${yearInt} creada correctamente.`);
            setHistoryModalVisible(false);
            setHistoryYear('');
            await refreshSeasons();
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "No se pudo crear el año histórico: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <MaterialIcons name="event-note" size={50} color="#5E35B1" />
                <Text style={styles.title}>Gestión de Temporadas</Text>
                <Text style={styles.subtitle}>Configura el año activo y crea nuevas campañas</Text>
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>Temporada Activa</Text>
                <View style={styles.yearBadge}>
                    <Text style={styles.yearText}>{currentYear}</Text>
                </View>
                <Text style={styles.info}>Esta es la temporada donde se registrarán los nuevos eventos y costaleros.</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Acciones</Text>

                <TouchableOpacity
                    style={[styles.button, styles.primaryButton]}
                    onPress={startNewSeason}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <>
                            <MaterialIcons name="fiber-new" size={24} color="white" />
                            <Text style={styles.buttonText}>Iniciar Temporada {currentYear + 1}</Text>
                        </>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, styles.secondaryButton]}
                    onPress={() => setHistoryModalVisible(true)}
                    disabled={loading}
                >
                    <MaterialIcons name="history" size={24} color="#5E35B1" />
                    <Text style={[styles.buttonText, { color: '#5E35B1' }]}>Añadir Año Histórico</Text>
                </TouchableOpacity>

                <View style={styles.warningBox}>
                    <MaterialIcons name="info" size={20} color="#D84315" />
                    <Text style={styles.warningText}>
                        Al crear años anteriores, podrás registrar asistencias y eventos de épocas pasadas para mantener tu historial completo.
                    </Text>
                </View>
            </View>

            {/* Modal Crear Año Histórico */}
            <Modal
                visible={historyModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setHistoryModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Crear Año Anterior</Text>
                        <Text style={styles.modalSubtitle}>Introduce el año que deseas dar de alta</Text>

                        <TextInput
                            style={styles.input}
                            placeholder="Ej: 2023"
                            keyboardType="numeric"
                            value={historyYear}
                            onChangeText={setHistoryYear}
                            autoFocus
                        />

                        <Text style={styles.inputLabel}>Copiar costaleros desde:</Text>
                        <View style={styles.pickerContainer}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {availableYears.map(year => (
                                    <TouchableOpacity
                                        key={year}
                                        style={[
                                            styles.miniBadge,
                                            cloneYear === String(year) && styles.miniBadgeActive
                                        ]}
                                        onPress={() => setCloneYear(String(year))}
                                    >
                                        <Text style={[
                                            styles.miniBadgeText,
                                            cloneYear === String(year) && styles.miniBadgeTextActive
                                        ]}>{year}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.actionBtn, { backgroundColor: '#BDBDBD' }]}
                                onPress={() => setHistoryModalVisible(false)}
                            >
                                <Text style={styles.btnText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actionBtn, { backgroundColor: '#5E35B1' }]}
                                onPress={createHistoricalSeason}
                                disabled={loading}
                            >
                                {loading ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>Crear</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Histórico disponible</Text>
                {availableYears.map(year => (
                    <View key={year} style={styles.yearItem}>
                        <Text style={styles.yearItemText}>Temporada {year}</Text>
                        {year === currentYear && <Text style={styles.activeTag}>ACTIVA</Text>}
                    </View>
                ))}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    header: {
        padding: 30,
        alignItems: 'center',
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#EEEEEE',
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        color: '#212121',
        marginTop: 10,
    },
    subtitle: {
        fontSize: 14,
        color: '#757575',
        marginTop: 5,
        textAlign: 'center',
    },
    card: {
        margin: 20,
        padding: 24,
        backgroundColor: 'white',
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#757575',
        marginBottom: 15,
        textTransform: 'uppercase',
    },
    yearBadge: {
        backgroundColor: '#EDE7F6',
        paddingHorizontal: 25,
        paddingVertical: 10,
        borderRadius: 30,
        marginBottom: 15,
    },
    yearText: {
        fontSize: 36,
        fontWeight: '900',
        color: '#5E35B1',
    },
    info: {
        fontSize: 13,
        color: '#9E9E9E',
        textAlign: 'center',
        lineHeight: 18,
    },
    section: {
        paddingHorizontal: 20,
        marginBottom: 30,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#BDBDBD',
        marginBottom: 15,
        paddingLeft: 5,
        textTransform: 'uppercase',
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
        borderRadius: 12,
        marginBottom: 15,
    },
    primaryButton: {
        backgroundColor: '#5E35B1',
    },
    secondaryButton: {
        backgroundColor: 'white',
        borderWidth: 2,
        borderColor: '#EDE7F6',
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '700',
        marginLeft: 10,
    },
    warningBox: {
        flexDirection: 'row',
        backgroundColor: '#FFF3E0',
        padding: 15,
        borderRadius: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#FF9800',
    },
    warningText: {
        flex: 1,
        fontSize: 12,
        color: '#E65100',
        marginLeft: 10,
        lineHeight: 18,
    },
    yearItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'white',
        padding: 18,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#EEEEEE',
    },
    yearItemText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#424242',
    },
    activeTag: {
        fontSize: 10,
        fontWeight: '800',
        color: '#4CAF50',
        backgroundColor: '#E8F5E9',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 5,
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
        maxWidth: 400,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 10
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
    input: {
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        padding: 15,
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
        color: '#5E35B1',
        marginBottom: 20
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#616161',
        marginBottom: 10
    },
    pickerContainer: {
        flexDirection: 'row',
        marginBottom: 20
    },
    miniBadge: {
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: '#F5F5F5',
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#EEEEEE'
    },
    miniBadgeActive: {
        backgroundColor: '#EDE7F6',
        borderColor: '#5E35B1'
    },
    miniBadgeText: {
        fontSize: 14,
        color: '#757575'
    },
    miniBadgeTextActive: {
        color: '#5E35B1',
        fontWeight: '700'
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10
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
    }
});
