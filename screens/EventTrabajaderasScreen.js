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
            // 1. Get Event Details to know the year
            const { data: eventData, error: eventError } = await supabase
                .from('eventos')
                .select('año')
                .eq('id', eventId)
                .single();

            if (eventError) throw eventError;

            // 2. Load costaleros for this year only
            const { data: costalerosData, error: costError } = await supabase
                .from('costaleros')
                .select('*')
                .eq('año', eventData.año || 2024)
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

            // Deduplicate: If there are multiple records for the same costalero, keep the most recent one
            const uniqueAsisMap = (asistenciasData || []).reduce((acc, a) => {
                const cId = a.costalero_id || a.costaleroId;
                if (!acc[cId] || new Date(a.timestamp) > new Date(acc[cId].timestamp)) {
                    acc[cId] = a;
                }
                return acc;
            }, {});
            const uniqueAsistenciasData = Object.values(uniqueAsisMap);

            // Filter and map asistencias
            // Create a map of attendance by costaleroId
            const attendanceMap = {};
            uniqueAsistenciasData.forEach(a => {
                attendanceMap[a.costalero_id || a.costaleroId] = a;
            });

            // Build full list: Costaleros + Status
            const fullList = (costalerosData || []).map(costalero => {
                const asistencia = attendanceMap[costalero.id];
                return {
                    id: asistencia ? asistencia.id : `pending-${costalero.id}`,
                    costaleroId: costalero.id,
                    nombreCostalero: `${costalero.nombre} ${costalero.apellidos}`,
                    status: asistencia ? asistencia.status : 'ausente', // Default to 'ausente' if no record
                    timestamp: asistencia ? asistencia.timestamp : null,
                    trabajadera: costalero.trabajadera // Ensure we have this for grouping
                };
            });

            setAsistencias(fullList);
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
                title: `Trabajadera ${i}`,
                data: grouped[key] || [],
                present: (grouped[key] || []).filter(i => i.status === 'presente').length,
                total: totals[key] || 0,
                trabajaderaNum: i
            });
        }

        // Add "Sin Asignar" if there are any
        if (totals['0'] > 0 || (grouped['0'] && grouped['0'].length > 0)) {
            result.push({
                title: 'Sin Asignar',
                data: grouped['0'] || [],
                present: (grouped['0'] || []).filter(i => i.status === 'presente').length,
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
            item.status === 'presente' && styles.presenteItem,
            item.status === 'ausente' && styles.ausenteItem
        ]}>
            <View style={{ flex: 1 }}>
                <Text style={styles.attendeeName}>{item.nombreCostalero}</Text>
                <View style={[styles.statusBadge, getBadgeStyle(item.status)]}>
                    <Text style={[styles.statusText, getTextStyle(item.status)]}>
                        {getStatusLabel(item.status)}
                    </Text>
                </View>
            </View>
            <Text style={styles.attendeeTime}>
                {item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
            </Text>
        </View>
    );

    const getBadgeStyle = (status) => {
        switch (status) {
            case 'presente': return { backgroundColor: '#E8F5E9', borderColor: '#4CAF50' };
            case 'justificado': return { backgroundColor: '#FFF3E0', borderColor: '#FF9800' };
            default: return { backgroundColor: '#FFEBEE', borderColor: '#F44336' };
        }
    };

    const getTextStyle = (status) => {
        switch (status) {
            case 'presente': return { color: '#2E7D32' };
            case 'justificado': return { color: '#EF6C00' };
            default: return { color: '#C62828' };
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'presente': return '✅ Presente';
            case 'justificado': return '📝 Justificado';
            default: return '❌ Ausente';
        }
    };

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
        paddingBottom: 150
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
    statusBadge: {
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 2,
        marginTop: 4
    },
    statusText: {
        fontSize: 11,
        fontWeight: 'bold'
    },
    ausenteItem: {
        backgroundColor: '#FFEBEE',
        borderLeftWidth: 3,
        borderLeftColor: '#F44336'
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
