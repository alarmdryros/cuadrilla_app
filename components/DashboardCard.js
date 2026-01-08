import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from './Icon';

export default function DashboardCard({ title, icon, children, onPress, color = '#1a5d1a' }) {
    const CardWrapper = onPress ? TouchableOpacity : View;

    return (
        <CardWrapper
            style={styles.card}
            onPress={onPress}
            activeOpacity={onPress ? 0.7 : 1}
        >
            <View style={styles.header}>
                <MaterialIcons name={icon} size={24} color={color} />
                <Text style={styles.title}>{title}</Text>
            </View>
            <View style={styles.content}>
                {children}
            </View>
            {onPress && (
                <View style={styles.arrow}>
                    <MaterialIcons name="chevron-right" size={20} color="#9E9E9E" />
                </View>
            )}
        </CardWrapper>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: '#212121',
        marginLeft: 8,
        flex: 1,
    },
    content: {
        marginTop: 4,
    },
    arrow: {
        position: 'absolute',
        right: 16,
        top: 16,
    },
});
