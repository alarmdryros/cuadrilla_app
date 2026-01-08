import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Dimensions, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { MaterialIcons } from '../components/Icon';
import { supabase } from '../supabaseConfig';
import { useAuth } from '../contexts/AuthContext';
import { useSeason } from '../contexts/SeasonContext';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';

export default function DatosPalioScreen({ navigation }) {
    const { userRole } = useAuth();
    const { selectedYear } = useSeason();
    const isManagement = ['superadmin', 'admin', 'capataz', 'auxiliar'].includes(userRole?.toLowerCase());

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Inicializar 7 trabajaderas con 0 cm
    const [measurements, setMeasurements] = useState(
        Array(7).fill(0).map((_, i) => ({ trabajadera: i + 1, diferencia_cm: '0' }))
    );

    const scrollViewRef = useRef(null);
    const screenWidth = Dimensions.get('window').width;
    const chartHeight = 220; // Slightly taller for visibility
    const svgWidth = screenWidth - 32; // The actual width of the SVG component

    const fetchConfig = useCallback(async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('palio_config')
                .select('*')
                .eq('anio', selectedYear)
                .order('trabajadera');

            if (error) throw error;

            if (data && data.length > 0) {
                const newMeasurements = Array(7).fill(0).map((_, i) => {
                    const found = data.find(d => d.trabajadera === i + 1);
                    return {
                        trabajadera: i + 1,
                        diferencia_cm: found ? found.diferencia_cm.toString() : '0'
                    };
                });
                setMeasurements(newMeasurements);
            } else {
                // Reset to 0 if no data for this year
                setMeasurements(Array(7).fill(0).map((_, i) => ({ trabajadera: i + 1, diferencia_cm: '0' })));
            }
        } catch (error) {
            console.error('Error fetching palio config:', error);
            Alert.alert('Error', 'No se pudieron cargar los datos del palio.');
        } finally {
            setLoading(false);
        }
    }, [selectedYear]);

    useEffect(() => {
        fetchConfig();
    }, [fetchConfig]);

    const handleSave = async () => {
        if (!isManagement) return;
        setSaving(true);
        try {
            const upsertData = measurements.map(m => {
                // Ensure strictly valid number or 0
                const val = parseFloat(m.diferencia_cm);
                return {
                    anio: selectedYear,
                    trabajadera: m.trabajadera,
                    diferencia_cm: isNaN(val) ? 0 : val
                };
            });

            const { error } = await supabase
                .from('palio_config')
                .upsert(upsertData, { onConflict: 'anio,trabajadera' });

            if (error) throw error;

            Alert.alert('Éxito', `Datos del palio para la temporada ${selectedYear} guardados correctamente.`);
        } catch (error) {
            console.error('Error saving palio config:', error);
            Alert.alert('Error', 'No se pudieron guardar los cambios. Verifique su conexión.');
        } finally {
            setSaving(false);
        }
    };

    const updateMeasurement = (trabajadera, value) => {
        // Sanitize Input:
        // 1. Replace commas with dots (for European keyboards)
        let sanitizedValue = value.replace(/,/g, '.');

        // 2. Remove leading zero if it's not a decimal number
        if (sanitizedValue === '') {
            // Allow empty
        } else if (sanitizedValue.startsWith('0') && sanitizedValue.length > 1 && sanitizedValue[1] !== '.') {
            sanitizedValue = sanitizedValue.substring(1);
        }

        // 3. Prevent multiple dots
        if ((sanitizedValue.match(/\./g) || []).length > 1) {
            return; // Ignore input if it would add a second dot
        }

        const newMeasurements = [...measurements];
        const index = newMeasurements.findIndex(m => m.trabajadera === trabajadera);
        if (index !== -1) {
            newMeasurements[index].diferencia_cm = sanitizedValue;
            setMeasurements(newMeasurements);
        }
    };

    // Manual scroll handler to ensure input visibility
    const handleInputFocus = (index) => {
        // Approximate Y position calculation:
        // Header ~80
        // Chart ~250 (height + margin)
        // Inputs Header ~100
        // Row height ~60 + diff indicator ~30

        const baseOffset = 380; // Start of list
        const rowHeight = 90; // Approx height per row including diffs
        const yPos = baseOffset + (index * rowHeight);

        // Scroll to position with some padding
        if (scrollViewRef.current) {
            scrollViewRef.current.scrollTo({ y: yPos, animated: true });
        }
    };

    // Chart Logic
    const getChartPath = () => {
        const padding = 20;
        // CORRECTED: Use svgWidth instead of screenWidth for calculation
        // availableWidth should be the width inside the SVG where points can go
        const availableWidth = svgWidth - (padding * 2);
        const stepX = availableWidth / 6; // 7 points divide into 6 segments

        const safeParse = (val) => {
            if (!val) return 0;
            const replaced = val.toString().replace(/,/g, '.');
            const num = parseFloat(replaced);
            return isNaN(num) ? 0 : num;
        };

        const values = measurements.map(m => safeParse(m.diferencia_cm));

        // DYNAMIC ADAPTIVE SCALING:
        // Identify min/max from data directly.
        let maxVal = Math.max(...values);
        let minVal = Math.min(...values);

        // Calculate span
        let span = maxVal - minVal;

        // Enforce minimum visual span of 5cm to prevent huge zooms on tiny noise
        // or flat lines breaking the graph (span=0)
        if (span < 5) {
            const center = (maxVal + minVal) / 2;
            maxVal = center + 2.5;
            minVal = center - 2.5;
            span = 5;
        }

        // Add 10% vertical padding
        const paddingY = span * 0.1;
        maxVal += paddingY;
        minVal -= paddingY;
        const range = maxVal - minVal;

        const getY = (val) => {
            const normalized = (val - minVal) / range;
            const y = chartHeight - (padding + normalized * (chartHeight - (padding * 2)));
            // Safety
            return (isNaN(y) || !isFinite(y)) ? chartHeight / 2 : y;
        };

        const points = measurements.map((m, i) => {
            const x = padding + (i * stepX);
            const valNum = safeParse(m.diferencia_cm);
            const y = getY(valNum);
            return { x, y, val: m.diferencia_cm, label: `T${m.trabajadera}`, valNum };
        });

        // Build Path
        let path = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
            path += ` L ${points[i].x} ${points[i].y}`;
        }

        return { path, points, zeroY: getY(0) };
    };

    const { path, points, zeroY } = getChartPath();

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0097A7" />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'} // Android usually handles 'height' or nothing better if manifest is adjustResize
            keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
        >
            <ScrollView
                ref={scrollViewRef}
                style={styles.container}
                contentContainerStyle={{ paddingBottom: 300 }}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.header}>
                    <Text style={styles.title}>Perfil de Trabajaderas</Text>
                    <Text style={styles.subtitle}>Temporada {selectedYear}</Text>
                </View>

                {/* CHART AREA */}
                <View style={styles.chartCard}>
                    <Svg height={chartHeight} width={svgWidth}>
                        {/* Zero Line */}
                        <Line
                            x1="20"
                            y1={zeroY}
                            x2={svgWidth - 20}
                            y2={zeroY}
                            stroke="#E0E0E0"
                            strokeWidth="2"
                            strokeDasharray="5, 5"
                        />

                        {/* Profile Path */}
                        <Path
                            d={path}
                            stroke="#0097A7"
                            strokeWidth="3"
                            fill="none"
                        />

                        {/* Diff Labels on Segments */}
                        {points.map((p, i) => {
                            if (i === 0) return null;
                            const prev = points[i - 1];
                            const midX = (prev.x + p.x) / 2;
                            const midY = (prev.y + p.y) / 2;
                            const diff = p.valNum - prev.valNum;
                            // Only show if diff is significant? Or always.
                            // User asked for visual diff.
                            if (Math.abs(diff) < 0.1) return null;

                            const diffText = (diff > 0 ? '+' : '') + diff.toFixed(1);
                            const textColor = diff > 0 ? '#4CAF50' : '#F44336';

                            return (
                                <SvgText
                                    key={`diff-${i}`}
                                    x={midX}
                                    y={midY - 8} // Slightly above the line
                                    fontSize="10"
                                    fontWeight="bold"
                                    fill={textColor}
                                    textAnchor="middle"
                                >
                                    {diffText}
                                </SvgText>
                            );
                        })}

                        {/* Points */}
                        {points.map((p, i) => (
                            <React.Fragment key={i}>
                                <Circle cx={p.x} cy={p.y} r="5" fill="#0097A7" />
                                <SvgText
                                    x={p.x}
                                    y={p.y - 10}
                                    fontSize="10"
                                    fill="#757575"
                                    textAnchor="middle"
                                >
                                    {p.val}
                                </SvgText>
                                <SvgText
                                    x={p.x}
                                    y={chartHeight - 5}
                                    fontSize="10"
                                    fill="#BDBDBD"
                                    textAnchor="middle"
                                >
                                    {p.label}
                                </SvgText>
                            </React.Fragment>
                        ))}
                    </Svg>
                </View>

                {/* INPUTS AREA */}
                <View style={styles.inputsContainer}>
                    <Text style={styles.sectionTitle}>Ajuste de Alturas (cm)</Text>
                    <Text style={styles.instructionText}>
                        Introduce la diferencia en cm de cada trabajadera respecto a la referencia (normalmente T1 o suelo).
                    </Text>

                    {measurements.map((item, index) => {
                        const prevItem = index > 0 ? measurements[index - 1] : null;
                        let diffText = null;
                        let diffColor = '#BDBDBD';

                        if (prevItem) {
                            const currentVal = parseFloat(item.diferencia_cm && item.diferencia_cm.replace(',', '.')) || 0;
                            const prevVal = parseFloat(prevItem.diferencia_cm && prevItem.diferencia_cm.replace(',', '.')) || 0;
                            const diff = currentVal - prevVal;

                            const diffFormatted = diff.toFixed(1).replace(/\.0$/, '');
                            const isPositive = diff > 0;
                            const isZero = Math.abs(diff) < 0.1;

                            if (!isZero) {
                                diffText = `${isPositive ? '+' : ''}${diffFormatted} cm`;
                                diffColor = isPositive ? '#4CAF50' : '#F44336';
                            } else {
                                diffText = "= 0 cm";
                            }
                        }

                        return (
                            <View key={item.trabajadera}>
                                {/* Connector / Difference Indicator */}
                                {index > 0 && (
                                    <View style={styles.diffContainer}>
                                        <View style={styles.diffLine} />
                                        <View style={styles.diffBadge}>
                                            <Text style={[styles.diffText, { color: diffColor }]}>
                                                {diffText}
                                            </Text>
                                        </View>
                                        <View style={styles.diffLine} />
                                    </View>
                                )}

                                <View style={styles.inputRow}>
                                    <View style={styles.labelContainer}>
                                        <View style={styles.trabajaderaBadge}>
                                            <Text style={styles.trabajaderaText}>T{item.trabajadera}</Text>
                                        </View>
                                    </View>

                                    <TextInput
                                        style={styles.input}
                                        value={item.diferencia_cm}
                                        onChangeText={(text) => updateMeasurement(item.trabajadera, text)}
                                        keyboardType="decimal-pad" // Better for numbers/decimals
                                        placeholder="0.0"
                                        selectTextOnFocus={true}
                                        editable={isManagement}
                                        onFocus={() => handleInputFocus(index)} // Manual scroll
                                    />
                                    <Text style={styles.unitText}>cm</Text>
                                </View>
                            </View>
                        );
                    })}
                </View>

                {isManagement && (
                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={styles.saveButton}
                            onPress={handleSave}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <>
                                    <MaterialIcons name="save" size={24} color="white" />
                                    <Text style={styles.saveButtonText}>GUARDAR DATOS</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        padding: 20,
        backgroundColor: 'white',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#212121',
    },
    subtitle: {
        fontSize: 14,
        color: '#0097A7',
        fontWeight: '600',
        marginTop: 4,
    },
    chartCard: {
        backgroundColor: 'white',
        margin: 16,
        padding: 10,
        borderRadius: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        alignItems: 'center',
        justifyContent: 'center'
    },
    inputsContainer: {
        paddingHorizontal: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#424242',
        marginBottom: 8,
    },
    instructionText: {
        fontSize: 13,
        color: '#757575',
        marginBottom: 20,
        lineHeight: 18
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        padding: 12,
        marginBottom: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E0E0E0'
    },
    labelContainer: {
        width: 50,
        justifyContent: 'center',
        alignItems: 'center'
    },
    trabajaderaBadge: {
        backgroundColor: '#E0F7FA',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 8,
    },
    trabajaderaText: {
        color: '#006064',
        fontWeight: 'bold',
        fontSize: 14
    },
    input: {
        flex: 1,
        fontSize: 18,
        fontWeight: '600',
        color: '#212121',
        textAlign: 'right',
        marginRight: 8,
        paddingVertical: 4
    },
    unitText: {
        fontSize: 16,
        color: '#9E9E9E',
        fontWeight: '500',
        width: 30
    },
    footer: {
        padding: 20,
        marginTop: 10
    },
    saveButton: {
        backgroundColor: '#0097A7',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 16,
        borderRadius: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 6,
    },
    saveButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 8,
        letterSpacing: 1
    },
    diffContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: -4, // Overlap slightly or tight spacing
        zIndex: -1,
        marginBottom: 8
    },
    diffLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#EEEEEE',
        marginTop: 0
    },
    diffBadge: {
        backgroundColor: '#FAFAFA',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#EEEEEE',
        marginHorizontal: 10
    },
    diffText: {
        fontSize: 12,
        fontWeight: 'bold',
    }
});
