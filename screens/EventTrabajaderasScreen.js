import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, SectionList, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../supabaseConfig';

export default function EventTrabajaderasScreen({ route, navigation }) {
    const { eventId, eventName } = route.params;
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
                .filter(data => data.status === 'presente' || data.status === 'justificado')
                .map(data => ({
                    ...data,
                    costaleroId: data.costalero_id // Map snake_case to camelCase for existing logic
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
            navigation.setOptions({ title: `Trabajaderas - ${eventName}` });
            fetchData();
        }, [eventId, eventName])
    );

    // Organize sections whenever asistencias or allCostaleros change
    useEffect(() => {
        if (allCostaleros.length > 0) {
            organizeSections(asistencias);
        }
    }, [asistencias, allCostaleros]);

    const organizeSections = (asistencias) => {
        // Create map of costaleroId -> trabajadera
        const costaleroMap = {};
        allCostaleros.forEach(c => {
            costaleroMap[c.id] = c.trabajadera || '0';
        });

        // Group attendees by trabajadera
        const grouped = {
            '1': [], '2': [], '3': [], '4': [], '5': [], '6': [], '7': [], '0': []
        };

        asistencias.forEach(asistencia => {
            const trabajadera = costaleroMap[asistencia.costaleroId] || '0';
            if (grouped[trabajadera]) {
                grouped[trabajadera].push(asistencia);
            } else {
                // Handle unexpected trabajadera just in case
                if (!grouped['0']) grouped['0'] = [];
                grouped['0'].push(asistencia);
            }
        });

        // Count total per trabajadera
        const totals = {
            '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '0': 0
        };
        allCostaleros.forEach(c => {
            const t = c.trabajadera ? c.trabajadera.toString() : '0';
            if (totals[t] !== undefined) {
                totals[t]++;
            } else {
                totals['0']++;
            }
        });

        // Build sections
        const result = [];
        for (let i = 1; i <= 7; i++) {
            const key = i.toString();
            result.push({
                title: `Trabajadera ${i}`,
                data: grouped[key] || [],
                present: (grouped[key] || []).length,
                total: totals[key] || 0,
                trabajaderaNum: i
            });
        }

        // Add "Sin Asignar" if there are any
        if (totals['0'] > 0 || (grouped['0'] && grouped['0'].length > 0)) {
            result.push({
                title: 'Sin Asignar',
                data: grouped['0'] || [],
                present: (grouped['0'] || []).length,
                total: totals['0'] || 0,
                trabajaderaNum: 0
            });
        }

        setSections(result);
    };

    const renderItem = ({ item }) => (
        <View style={[
            styles.attendeeItem,
            item.status === 'justificado' && styles.justifiedItem,
            item.status === 'presente' && styles.presenteItem
        ]}>
            <View style={{ flex: 1 }}>
                <Text style={styles.attendeeName}>{item.nombreCostalero}</Text>
                {item.status === 'justificado' && (
                    <Text style={styles.justifiedBadge}>📝 Justificado</Text>
                )}
                {item.status === 'presente' && (
                    <Text style={styles.presenteBadge}>✅ Presente</Text>
                )}
            </View>
            <Text style={styles.attendeeTime}>
                {item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
            </Text>
        </View>
    );

    const renderSectionHeader = ({ section }) => {
        const percentage = section.total > 0 ? Math.round((section.present / section.total) * 100) : 0;
        const isComplete = section.present === section.total && section.total > 0;
        const isEmpty = section.present === 0;

        return (
            <View style={[styles.sectionHeader, isComplete && styles.sectionHeaderComplete]}>
                <View style={styles.sectionHeaderLeft}>
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                    <Text style={[styles.sectionCount, isComplete && styles.sectionCountComplete]}>
                        {section.present}/{section.total} presentes
                    </Text>
                </View>
                <View style={styles.percentageContainer}>
                    <Text style={[styles.percentage, isComplete && styles.percentageComplete]}>
                        {percentage}%
                    </Text>
                </View>
            </View>
        );
    };

    const renderSectionFooter = ({ section }) => {
        if (section.data.length === 0) {
            return (
                <View style={styles.emptySection}>
                    <Text style={styles.emptySectionText}>Ningún costalero presente aún</Text>
                </View>
            );
        }
        return null;
    };

    if (loading) return <ActivityIndicator style={styles.center} size="large" />;

    return (
        <View style={styles.container}>
            <SectionList
                sections={sections}
                keyExtractor={(item, index) => item.id + index}
                renderItem={renderItem}
                renderSectionHeader={renderSectionHeader}
                renderSectionFooter={renderSectionFooter}
                stickySectionHeadersEnabled={true}
                contentContainerStyle={styles.list}
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
    list: {
        paddingBottom: 20
    },
    sectionHeader: {
        backgroundColor: '#F5F5F5',
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: '#E0E0E0',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    sectionHeaderComplete: {
        backgroundColor: '#E8F5E9',
        borderBottomColor: '#4CAF50'
    },
    sectionHeaderLeft: {
        flex: 1
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#5E35B1',
        letterSpacing: 0.5,
        textTransform: 'uppercase'
    },
    sectionCount: {
        fontSize: 14,
        color: '#757575',
        marginTop: 4,
        fontWeight: '500'
    },
    sectionCountComplete: {
        color: '#4CAF50'
    },
    percentageContainer: {
        backgroundColor: '#E0E0E0',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        minWidth: 60,
        alignItems: 'center'
    },
    percentage: {
        fontSize: 16,
        fontWeight: '700',
        color: '#757575'
    },
    percentageComplete: {
        color: '#4CAF50'
    },
    attendeeItem: {
        backgroundColor: 'white',
        padding: 14,
        marginHorizontal: 16,
        marginVertical: 3,
        borderRadius: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 1,
    },
    justifiedItem: {
        backgroundColor: '#FFF3E0',
        borderLeftWidth: 3,
        borderLeftColor: '#FF9800'
    },
    presenteItem: {
        backgroundColor: '#E8F5E9',
        borderLeftWidth: 3,
        borderLeftColor: '#4CAF50'
    },
    attendeeName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#212121',
    },
    justifiedBadge: {
        fontSize: 12,
        color: '#FF9800',
        marginTop: 4,
        fontWeight: '600'
    },
    presenteBadge: {
        fontSize: 12,
        color: '#4CAF50',
        marginTop: 4,
        fontWeight: '600'
    },
    attendeeTime: {
        fontSize: 13,
        color: '#9E9E9E',
        fontWeight: '500'
    },
    emptySection: {
        padding: 20,
        alignItems: 'center'
    },
    emptySectionText: {
        color: '#BDBDBD',
        fontSize: 14,
        fontStyle: 'italic'
    }
});
