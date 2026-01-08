import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Image, Animated } from 'react-native';
import { MaterialIcons } from '../components/Icon';
import { supabase } from '../supabaseConfig';

export default function LoginScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Animaciones
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;
    const logoScale = useRef(new Animated.Value(0.8)).current;
    const shakeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Secuencia de animaciones al montar
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            }),
            Animated.sequence([
                Animated.timing(logoScale, {
                    toValue: 1.05,
                    duration: 600,
                    useNativeDriver: true,
                }),
                Animated.timing(logoScale, {
                    toValue: 1,
                    duration: 400,
                    useNativeDriver: true,
                }),
            ]),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 600,
                delay: 200,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const shakeAnimation = () => {
        Animated.sequence([
            Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
        ]).start();
    };

    const handleLogin = async () => {
        if (!email || !password) {
            shakeAnimation();
            Alert.alert("Error", "Por favor, introduce email y contraseña");
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                throw error;
            }
            // Navigation provided by App.js auth state listener
        } catch (error) {
            console.error(error);
            shakeAnimation();
            Alert.alert("Error", error.message || "Error al iniciar sesión");
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
                <Animated.View style={[styles.logoContainer, { transform: [{ scale: logoScale }] }]}>
                    <Image
                        source={require('../assets/escudo-hermandad-logo.jpg')}
                        style={styles.logoImage}
                        resizeMode="contain"
                    />
                </Animated.View>
                <Text style={styles.title}>Hermandad de la Soledad</Text>
                <Text style={styles.subtitle}>Ayamonte</Text>
                <Text style={styles.appName}>Gestión de Cuadrilla</Text>

                <Animated.View style={[styles.form, {
                    transform: [
                        { translateY: slideAnim },
                        { translateX: shakeAnim }
                    ]
                }]}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                        style={styles.input}
                        value={email}
                        onChangeText={setEmail}
                        placeholder="tu@email.com"
                        placeholderTextColor="#666666"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="email"
                        textContentType="emailAddress"
                    />

                    <Text style={styles.label}>Contraseña</Text>
                    <View style={styles.passwordContainer}>
                        <TextInput
                            style={styles.passwordInput}
                            value={password}
                            onChangeText={setPassword}
                            placeholder="••••••••"
                            placeholderTextColor="#666666"
                            secureTextEntry={!showPassword}
                            autoCapitalize="none"
                            autoComplete="password"
                            textContentType="password"
                        />
                        <TouchableOpacity
                            style={styles.eyeButton}
                            onPress={() => setShowPassword(!showPassword)}
                        >
                            <MaterialIcons
                                name={showPassword ? "visibility" : "visibility-off"}
                                size={24}
                                color="#1a5d1a"
                            />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <ActivityIndicator size="large" color="#1a5d1a" style={styles.loader} />
                    ) : (
                        <TouchableOpacity
                            style={styles.button}
                            onPress={handleLogin}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.buttonText}>Iniciar Sesión</Text>
                        </TouchableOpacity>
                    )}
                </Animated.View>

                <TouchableOpacity
                    style={styles.registerButton}
                    onPress={() => navigation.navigate('Register')}
                >
                    <Text style={styles.registerText}>¿No tienes cuenta? Regístrate aquí</Text>
                </TouchableOpacity>

                <Text style={styles.hint}>Capataces y costaleros autorizados</Text>
            </Animated.View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 30
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 30
    },
    logoImage: {
        width: 160,
        height: 160,
        borderRadius: 12,
        borderWidth: 3,
        borderColor: '#1a5d1a',
        shadowColor: '#1a5d1a',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.9,
        shadowRadius: 20,
        elevation: 15
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#ffffff',
        textAlign: 'center',
        marginBottom: 4,
        letterSpacing: 1,
        textShadowColor: 'rgba(26, 93, 26, 0.3)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4
    },
    subtitle: {
        fontSize: 16,
        color: '#b0b0b0',
        textAlign: 'center',
        marginBottom: 8,
        letterSpacing: 2,
        textTransform: 'uppercase'
    },
    appName: {
        fontSize: 14,
        color: '#1a5d1a',
        textAlign: 'center',
        marginBottom: 40,
        fontStyle: 'italic'
    },
    form: {
        backgroundColor: '#1a1a1a',
        padding: 24,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#2a2a2a',
        shadowColor: "#1a5d1a",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 6,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#ffffff',
        marginBottom: 8,
        marginTop: 12
    },
    input: {
        borderWidth: 2,
        borderColor: '#2a2a2a',
        borderRadius: 8,
        padding: 14,
        fontSize: 16,
        backgroundColor: '#0a0a0a',
        color: '#ffffff',
        transition: 'border-color 0.3s'
    },
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#2a2a2a',
        borderRadius: 8,
        backgroundColor: '#0a0a0a',
        paddingRight: 10
    },
    passwordInput: {
        flex: 1,
        padding: 14,
        fontSize: 16,
        color: '#ffffff'
    },
    eyeButton: {
        padding: 8
    },
    button: {
        backgroundColor: '#1a5d1a',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 24,
        shadowColor: "#1a5d1a",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.6,
        shadowRadius: 10,
        elevation: 8,
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5,
        textAlign: 'center'
    },
    loader: {
        marginTop: 24,
        color: '#1a5d1a'
    },
    registerButton: {
        marginTop: 20,
        padding: 12,
        alignItems: 'center'
    },
    registerText: {
        color: '#1a5d1a',
        fontSize: 14,
        fontWeight: '600'
    },
    hint: {
        textAlign: 'center',
        color: '#666666',
        fontSize: 13,
        marginTop: 24,
        fontStyle: 'italic'
    }
});
