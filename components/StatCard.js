import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from './Icon';

export default function StatCard({ label, value, icon, color = '#1a5d1a', subtitle }) {
    return (
        <View style={[styles.card, { borderLeftColor: color }]}>
            <MaterialIcons name={icon} size={32} color={color} style={styles.icon} />
            <Text style={styles.value}>{value}</Text>
            <Text style={styles.label}>{label}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
        borderLeftWidth: 4,
        minHeight: 120,
    },
    icon: {
        marginBottom: 8,
        opacity: 0.8,
    },
    value: {
        fontSize: 28,
        fontWeight: '700',
        color: '#212121',
        marginBottom: 4,
    },
    label: {
        fontSize: 12,
        color: '#757575',
        textAlign: 'center',
        fontWeight: '600',
    },
    subtitle: {
        fontSize: 11,
        color: '#9E9E9E',
        marginTop: 2,
        textAlign: 'center',
    },
});
