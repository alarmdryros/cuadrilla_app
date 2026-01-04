import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Alert } from 'react-native';
import { MaterialIcons } from './Icon';
import { supabase } from '../supabaseConfig';
import { useAuth } from '../contexts/AuthContext';
import { useSeason } from '../contexts/SeasonContext';
import { Picker } from '@react-native-picker/picker';

export default function SideMenu({ visible, onClose, navigation }) {
    const { userRole, userProfile, user } = useAuth();
    const { selectedYear, availableYears, changeSelectedYear } = useSeason();

    const isManagement = ['superadmin', 'admin', 'capataz', 'auxiliar'].includes(userRole?.toLowerCase());

    const navigateAndClose = (screen, params = {}) => {
        onClose();
        navigation.navigate(screen, params);
    };

    const handleLogout = async () => {
        try {
            await supabase.auth.signOut();
            onClose();
        } catch (error) {
            Alert.alert("Error", "No se pudo cerrar sesión.");
        }
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableOpacity
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={onClose}
            >
                <View style={styles.menuContainer}>
                    <View style={styles.menuHeader}>
                        <MaterialIcons name="event-note" size={48} color="#5E35B1" />
                        <Text style={styles.menuTitle}>Cuadrilla App</Text>
                        <Text style={styles.menuSubtitle}>
                            {isManagement ? 'Gestión de Costaleros' : 'Panel de Costalero'}
                        </Text>
                        {!isManagement && userProfile && (
                            <Text style={styles.userEmail}>{userProfile.email}</Text>
                        )}
                    </View>

                    <ScrollView
                        style={styles.menuItemsContainer}
                        contentContainerStyle={{ paddingBottom: 20 }}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* SECCIÓN PÚBLICA / TODOS */}
                        <TouchableOpacity style={styles.menuItem} onPress={() => navigateAndClose('Dashboard')}>
                            <View style={[styles.iconContainer, { backgroundColor: '#E8F5E9' }]}>
                                <MaterialIcons name="home" size={20} color="#1a5d1a" />
                            </View>
                            <Text style={styles.menuText}>Inicio</Text>
                            <MaterialIcons name="chevron-right" size={20} color="#BDBDBD" style={{ marginLeft: 'auto' }} />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.menuItem} onPress={() => navigateAndClose('Announcements')}>
                            <View style={[styles.iconContainer, { backgroundColor: '#EDE7F6' }]}>
                                <MaterialIcons name="event-note" size={20} color="#5E35B1" />
                            </View>
                            <Text style={styles.menuText}>Tablón de Anuncios</Text>
                            <MaterialIcons name="chevron-right" size={20} color="#BDBDBD" style={{ marginLeft: 'auto' }} />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.menuItem} onPress={() => navigateAndClose('EventsList')}>
                            <View style={[styles.iconContainer, { backgroundColor: '#E1F5FE' }]}>
                                <MaterialIcons name="event" size={20} color="#0288D1" />
                            </View>
                            <Text style={styles.menuText}>Calendario de Eventos</Text>
                            <MaterialIcons name="chevron-right" size={20} color="#BDBDBD" style={{ marginLeft: 'auto' }} />
                        </TouchableOpacity>

                        {isManagement && (
                            <>
                                <View style={styles.sectionDivider} />
                                <Text style={styles.sectionTitle}>GESTIÓN</Text>

                                <TouchableOpacity style={styles.menuItem} onPress={() => navigateAndClose('EventForm')}>
                                    <View style={[styles.iconContainer, { backgroundColor: '#F3E5F5' }]}>
                                        <MaterialIcons name="add-circle-outline" size={20} color="#7B1FA2" />
                                    </View>
                                    <Text style={styles.menuText}>Nuevo Evento</Text>
                                    <MaterialIcons name="chevron-right" size={20} color="#BDBDBD" style={{ marginLeft: 'auto' }} />
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.menuItem} onPress={() => navigateAndClose('CostalerosList')}>
                                    <View style={[styles.iconContainer, { backgroundColor: '#E3F2FD' }]}>
                                        <MaterialIcons name="people-outline" size={20} color="#1565C0" />
                                    </View>
                                    <Text style={styles.menuText}>Cuadrilla</Text>
                                    <MaterialIcons name="chevron-right" size={20} color="#BDBDBD" style={{ marginLeft: 'auto' }} />
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.menuItem} onPress={() => navigateAndClose('DatosPalio')}>
                                    <View style={[styles.iconContainer, { backgroundColor: '#E0F7FA' }]}>
                                        <MaterialIcons name="view-list" size={20} color="#0097A7" />
                                    </View>
                                    <Text style={styles.menuText}>Datos Palio</Text>
                                    <MaterialIcons name="chevron-right" size={20} color="#BDBDBD" style={{ marginLeft: 'auto' }} />
                                </TouchableOpacity>


                                <TouchableOpacity style={styles.menuItem} onPress={() => navigateAndClose('Export')}>
                                    <View style={[styles.iconContainer, { backgroundColor: '#E8F5E9' }]}>
                                        <MaterialIcons name="file-download" size={20} color="#2E7D32" />
                                    </View>
                                    <Text style={styles.menuText}>Exportar Datos</Text>
                                    <MaterialIcons name="chevron-right" size={20} color="#BDBDBD" style={{ marginLeft: 'auto' }} />
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.menuItem} onPress={() => navigateAndClose('SeasonManagement')}>
                                    <View style={[styles.iconContainer, { backgroundColor: '#FBE9E7' }]}>
                                        <MaterialIcons name="settings-applications" size={20} color="#D84315" />
                                    </View>
                                    <Text style={styles.menuText}>Configurar Temporada</Text>
                                    <MaterialIcons name="chevron-right" size={20} color="#BDBDBD" style={{ marginLeft: 'auto' }} />
                                </TouchableOpacity>
                            </>
                        )}

                        {!isManagement && (
                            <>
                                <View style={styles.sectionDivider} />
                                <Text style={styles.sectionTitle}>MI PERFIL</Text>
                                <TouchableOpacity style={styles.menuItem} onPress={() => {
                                    navigateAndClose('CostaleroHistory', {
                                        costaleroId: userProfile?.costalero_id,
                                        costaleroName: userProfile?.nombre
                                    });
                                }}>
                                    <View style={[styles.iconContainer, { backgroundColor: '#E1F5FE' }]}>
                                        <MaterialIcons name="history" size={20} color="#0288D1" />
                                    </View>
                                    <Text style={styles.menuText}>Mi Historial</Text>
                                    <MaterialIcons name="chevron-right" size={20} color="#BDBDBD" style={{ marginLeft: 'auto' }} />
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.menuItem} onPress={() => {
                                    navigateAndClose('CostaleroForm', {
                                        costaleroId: userProfile?.costalero_id,
                                        readOnly: true
                                    });
                                }}>
                                    <View style={[styles.iconContainer, { backgroundColor: '#F3E5F5' }]}>
                                        <MaterialIcons name="person-outline" size={20} color="#9C27B0" />
                                    </View>
                                    <Text style={styles.menuText}>Mi Perfil</Text>
                                    <MaterialIcons name="chevron-right" size={20} color="#BDBDBD" style={{ marginLeft: 'auto' }} />
                                </TouchableOpacity>
                            </>
                        )}

                        {userRole === 'superadmin' && (
                            <TouchableOpacity style={styles.menuItem} onPress={() => navigateAndClose('SuperAdmin')}>
                                <View style={[styles.iconContainer, { backgroundColor: '#FFEBEE' }]}>
                                    <MaterialIcons name="security" size={20} color="#D32F2F" />
                                </View>
                                <Text style={styles.menuText}>Panel Super Admin</Text>
                                <MaterialIcons name="chevron-right" size={20} color="#BDBDBD" style={{ marginLeft: 'auto' }} />
                            </TouchableOpacity>
                        )}
                    </ScrollView>

                    <View style={styles.seasonSelector}>
                        <View style={styles.seasonHeader}>
                            <View style={[styles.iconContainer, { backgroundColor: '#EDE7F6', width: 32, height: 32 }]}>
                                <MaterialIcons name="date-range" size={18} color="#5E35B1" />
                            </View>
                            <Text style={styles.seasonLabel}>Temporada:</Text>
                        </View>
                        <View style={styles.pickerWrapper}>
                            <View style={styles.fakePicker}>
                                <Text style={styles.fakePickerText}>Temporada {selectedYear}</Text>
                                <MaterialIcons name="arrow-drop-down" size={24} color="#5E35B1" />
                            </View>
                            <Picker
                                selectedValue={selectedYear}
                                onValueChange={(itemValue) => changeSelectedYear(itemValue)}
                                style={styles.hiddenPicker}
                                dropdownIconColor="transparent"
                                mode="dialog"
                            >
                                {availableYears.map(year => (
                                    <Picker.Item key={year} label={`Temporada ${year}`} value={year} />
                                ))}
                            </Picker>
                        </View>
                    </View>

                    <View style={styles.menuFooter}>
                        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                            <MaterialIcons name="logout" size={20} color="#D32F2F" />
                            <Text style={styles.logoutText}>Cerrar Sesión</Text>
                        </TouchableOpacity>
                        <Text style={styles.versionText}>v2.5.15</Text>
                    </View>
                </View>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        flexDirection: 'row'
    },
    menuContainer: {
        width: '88%',
        backgroundColor: 'white',
        paddingVertical: 25,
        paddingHorizontal: 20,
        shadowColor: "#000",
        shadowOffset: { width: 4, height: 0 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 16,
        borderTopRightRadius: 20,
        borderBottomRightRadius: 20,
        maxHeight: '100%'
    },
    menuHeader: {
        marginBottom: 16,
        marginTop: 0,
        alignItems: 'center'
    },
    menuTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#424242',
        marginTop: 8,
        letterSpacing: 0.5
    },
    menuSubtitle: {
        fontSize: 12,
        color: '#9E9E9E',
        fontWeight: '700',
        marginTop: 2
    },
    userEmail: {
        fontSize: 12,
        color: '#5E35B1',
        marginTop: 4,
        fontWeight: '600'
    },
    menuItemsContainer: {
        flex: 1
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        marginBottom: 4,
        borderRadius: 12,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12
    },
    menuText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#424242',
        letterSpacing: 0.3
    },
    sectionDivider: {
        height: 1,
        backgroundColor: '#EEE',
        marginVertical: 15
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '900',
        color: '#9E9E9E',
        marginBottom: 8,
        letterSpacing: 1
    },
    seasonSelector: {
        marginTop: "auto",
        paddingTop: 15,
        borderTopWidth: 1,
        borderTopColor: '#EEEEEE',
        marginBottom: 10
    },
    seasonHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10
    },
    seasonLabel: {
        fontSize: 13,
        fontWeight: '900',
        color: '#424242',
        marginLeft: 10,
        letterSpacing: 0.3
    },
    pickerWrapper: {
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        position: 'relative',
        height: 55,
        justifyContent: 'center',
    },
    fakePicker: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        width: '100%',
    },
    fakePickerText: {
        fontSize: 16,
        fontWeight: '900',
        color: '#212121',
    },
    hiddenPicker: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0,
        width: '100%',
        height: '100%',
    },
    menuFooter: {
        marginTop: 20,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: '#EEEEEE',
        alignItems: 'center'
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFEBEE',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 30,
        marginBottom: 16
    },
    logoutText: {
        color: '#D32F2F',
        fontWeight: '900',
        marginLeft: 8,
        fontSize: 15
    },
    versionText: {
        fontSize: 12,
        color: '#BDBDBD'
    }
});
