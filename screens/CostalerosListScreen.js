import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, SectionList, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../supabaseConfig';
import { useSeason } from '../contexts/SeasonContext';
import { MaterialIcons } from '../components/Icon';

import { normalizeString } from '../utils/stringUtils';

export default function CostalerosListScreen({ navigation }) {
    const { selectedYear } = useSeason();
    const [sections, setSections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [allCostaleros, setAllCostaleros] = useState([]);

    const fetchCostaleros = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('costaleros')
                .select('*')
                .eq('año', selectedYear)
                .order('apellidos', { ascending: true });

            if (error) throw error;
            setAllCostaleros(data || []);

            // Diagnostic: Check if there are costaleros in OTHER years if this one has few
            if (!data || data.length < 10) {
                const { count: totalGlobal } = await supabase
                    .from('costaleros')
                    .select('*', { count: 'exact', head: true });

                if (totalGlobal > (data?.length || 0)) {
                    console.log(`Diagnostic: Found ${totalGlobal} costaleros in total vs ${(data?.length || 0)} in ${selectedYear}.`);
                }
            }
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "No se pudieron cargar los costaleros");
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            navigation.setOptions({
                title: 'Cuadrilla',
                headerTitleAlign: 'center',
                headerLeft: () => (
                    <TouchableOpacity onPress={() => navigation.navigate('Dashboard')} style={{ marginLeft: 8, padding: 8 }}>
                        <MaterialIcons name="arrow-back" size={26} color="#212121" />
                    </TouchableOpacity>
                ),
            });
            fetchCostaleros();
        }, [selectedYear, navigation])
    );

    useEffect(() => {
        const query = normalizeString(searchQuery);
        const filtered = allCostaleros.filter(c => {
            const fullName = normalizeString(`${c.nombre} ${c.apellidos}`);
            return fullName.includes(query);
        });
        organizeSections(filtered);
    }, [allCostaleros, searchQuery]);

    const organizeSections = (data) => {
        const grouped = {
            '1': [], '2': [], '3': [], '4': [], '5': [], '6': [], '7': [], '0': []
        };

        data.forEach(c => {
            const t = c.trabajadera ? c.trabajadera.toString() : '0';
            if (grouped[t]) {
                grouped[t].push(c);
            } else {
                grouped['0'].push(c);
            }
        });

        const result = [];
        for (let i = 1; i <= 7; i++) {
            const tKey = i.toString();
            if (grouped[tKey].length > 0) {
                result.push({
                    title: `Trabajadera ${i}`,
                    data: grouped[tKey],
                    count: grouped[tKey].length
                });
            }
        }
        if (grouped['0'].length > 0) {
            result.push({
                title: 'Sin Asignar',
                data: grouped['0'],
                count: grouped['0'].length
            });
        }
        setSections(result);
    };

    const renderItem = ({ item }) => (
        <TouchableOpacity
            style={styles.item}
            onPress={() => navigation.navigate('CostaleroForm', { costaleroId: item.id })}
        >
            <View>
                <Text style={styles.name}>{item.apellidos}, {item.nombre}</Text>
                <Text style={styles.details}>{item.puesto} - {item.altura}m</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
    );

    const renderSectionHeader = ({ section: { title, count } }) => (
        <View style={styles.header}>
            <Text style={styles.headerTitle}>{title} ({count})</Text>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.statsHeader}>
                <Text style={styles.statsTitle}>CUADRILLA {selectedYear}</Text>
                <Text style={styles.statsCount}>{allCostaleros.length} costaleros registrados</Text>
            </View>

            <View style={styles.searchContainer}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="🔍 Buscar costalero..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#0000ff" />
            ) : (
                <SectionList
                    sections={sections}
                    keyExtractor={(item, index) => item.id + index}
                    renderItem={renderItem}
                    renderSectionHeader={renderSectionHeader}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    ListEmptyComponent={<Text style={styles.emptyText}>No se encontraron costaleros.</Text>}
                />
            )}

            <TouchableOpacity
                style={styles.fab}
                onPress={() => navigation.navigate('CostaleroForm')}
            >
                <Text style={styles.fabText}>+</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA'
    },
    statsHeader: {
        backgroundColor: 'white',
        paddingVertical: 16,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    statsTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#5E35B1',
        letterSpacing: 1
    },
    statsCount: {
        fontSize: 14,
        color: '#757575',
        marginTop: 4,
        fontWeight: '500'
    },
    searchContainer: {
        backgroundColor: 'white',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    searchInput: {
        backgroundColor: '#F5F5F5',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: '#212121',
        borderWidth: 1,
        borderColor: '#E0E0E0'
    },
    header: {
        backgroundColor: '#F5F5F5',
        padding: 14,
        borderBottomWidth: 0,
        marginBottom: 2
    },
    headerTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#5E35B1',
        letterSpacing: 0.5,
        textTransform: 'uppercase'
    },
    item: {
        backgroundColor: 'white',
        padding: 16,
        marginHorizontal: 16,
        marginVertical: 4,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderRadius: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    name: {
        fontSize: 16,
        fontWeight: '600',
        color: '#212121'
    },
    details: {
        color: '#757575',
        fontSize: 14,
        marginTop: 4
    },
    arrow: {
        fontSize: 22,
        color: '#BDBDBD',
        fontWeight: '300'
    },
    fab: {
        position: 'absolute',
        width: 56,
        height: 56,
        alignItems: 'center',
        justifyContent: 'center',
        right: 20,
        bottom: 40,
        backgroundColor: '#5E35B1',
        borderRadius: 28,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    fabText: {
        color: 'white',
        fontSize: 28,
        fontWeight: '300'
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 80,
        color: '#9E9E9E',
        fontSize: 16
    }
});
