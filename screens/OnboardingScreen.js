import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, FlatList, Dimensions, StatusBar } from 'react-native';
import { MaterialIcons } from '../components/Icon';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

const SLIDES = [
    {
        id: '1',
        title: '¡Bienvenido a tu Cuadrilla!',
        description: 'Toda la información de tu cofradía y tus ensayos en un solo lugar.',
        icon: 'church',
        color: '#1a5d1a'
    },
    {
        id: '2',
        title: 'Gestión de Ensayos',
        description: 'Consulta las fechas, lugares y confirma tu asistencia mediante código QR.',
        icon: 'qr-code-scanner',
        color: '#2e7d32'
    },
    {
        id: '3',
        title: 'Estadísticas y Avisos',
        description: 'Mantente al tanto de los últimos anuncios y revisa tu historial de asistencia.',
        icon: 'analytics',
        color: '#388e3c'
    }
];

export default function OnboardingScreen({ navigation }) {
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
    const flatListRef = useRef(null);

    const updateCurrentSlideIndex = e => {
        const contentOffsetX = e.nativeEvent.contentOffset.x;
        const currentIndex = Math.round(contentOffsetX / width);
        setCurrentSlideIndex(currentIndex);
    };

    const goToNextSlide = () => {
        const nextSlideIndex = currentSlideIndex + 1;
        if (nextSlideIndex !== SLIDES.length) {
            const offset = nextSlideIndex * width;
            flatListRef?.current?.scrollToOffset({ offset });
            setCurrentSlideIndex(nextSlideIndex);
        }
    };

    const finishOnboarding = async () => {
        try {
            await AsyncStorage.setItem('hasSeenOnboarding', 'true');
            // Recargar el estado en App.js o navegar
            navigation.replace('MainTabs');
        } catch (error) {
            console.error('Error saving onboarding state:', error);
            navigation.replace('MainTabs');
        }
    };

    const Slide = ({ item }) => {
        return (
            <View style={styles.slide}>
                <View style={[styles.iconContainer, { backgroundColor: item.color + '15' }]}>
                    <MaterialIcons name={item.icon} size={100} color={item.color} />
                </View>
                <View style={styles.textContainer}>
                    <Text style={styles.title}>{item.title}</Text>
                    <Text style={styles.description}>{item.description}</Text>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="white" />
            <FlatList
                ref={flatListRef}
                onMomentumScrollEnd={updateCurrentSlideIndex}
                data={SLIDES}
                contentContainerStyle={{ height: height * 0.75 }}
                horizontal
                showsHorizontalScrollIndicator={false}
                pagingEnabled
                renderItem={({ item }) => <Slide item={item} />}
                keyExtractor={(item) => item.id}
            />

            <View style={styles.footer}>
                {/* Indicadores */}
                <View style={styles.indicatorContainer}>
                    {SLIDES.map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.indicator,
                                currentSlideIndex === index && styles.activeIndicator
                            ]}
                        />
                    ))}
                </View>

                {/* Botones */}
                <View style={styles.buttonContainer}>
                    {currentSlideIndex === SLIDES.length - 1 ? (
                        <TouchableOpacity style={styles.btn} onPress={finishOnboarding}>
                            <Text style={styles.btnText}>EMPEZAR</Text>
                        </TouchableOpacity>
                    ) : (
                        <>
                            <TouchableOpacity activeOpacity={0.8} style={styles.skipBtn} onPress={finishOnboarding}>
                                <Text style={styles.skipBtnText}>OMITIR</Text>
                            </TouchableOpacity>
                            <TouchableOpacity activeOpacity={0.8} style={styles.btn} onPress={goToNextSlide}>
                                <Text style={styles.btnText}>SIGUIENTE</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white'
    },
    slide: {
        width,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40
    },
    iconContainer: {
        width: 200,
        height: 200,
        borderRadius: 100,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 40
    },
    textContainer: {
        alignItems: 'center'
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#212121',
        textAlign: 'center',
        marginBottom: 15
    },
    description: {
        fontSize: 16,
        color: '#757575',
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: 20
    },
    footer: {
        height: height * 0.25,
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 40
    },
    indicatorContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 20
    },
    indicator: {
        height: 4,
        width: 12,
        backgroundColor: '#E0E0E0',
        marginHorizontal: 4,
        borderRadius: 2
    },
    activeIndicator: {
        backgroundColor: '#1a5d1a',
        width: 24
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    btn: {
        flex: 1,
        height: 56,
        borderRadius: 12,
        backgroundColor: '#1a5d1a',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        marginLeft: 10
    },
    btnText: {
        fontWeight: 'bold',
        fontSize: 16,
        color: 'white',
        letterSpacing: 1
    },
    skipBtn: {
        flex: 1,
        height: 56,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10
    },
    skipBtnText: {
        fontWeight: 'bold',
        fontSize: 14,
        color: '#757575',
        letterSpacing: 1
    }
});
