import * as React from 'react';
import { View, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialIcons } from './components/Icon';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SeasonProvider } from './contexts/SeasonContext';
import { NotificationProvider } from './contexts/NotificationContext';

// Screens
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import CostalerosListScreen from './screens/CostalerosListScreen';
import CostaleroFormScreen from './screens/CostaleroFormScreen';
import EventsListScreen from './screens/EventsListScreen';
import EventDetailScreen from './screens/EventDetailScreen';
import EventFormScreen from './screens/EventFormScreen';
import QRScannerScreen from './screens/QRScannerScreen';
import CostaleroHistoryScreen from './screens/CostaleroHistoryScreen';
import EventTrabajaderasScreen from './screens/EventTrabajaderasScreen';
import ExportScreen from './screens/ExportScreen';
import RelayManagementScreen from './screens/RelayManagementScreen';
import MeasurementScreen from './screens/MeasurementScreen';
import AttendeeListScreen from './screens/AttendeeListScreen';
import PendingListScreen from './screens/PendingListScreen';
import SeasonManagementScreen from './screens/SeasonManagementScreen';
import NotificationsListScreen from './screens/NotificationsListScreen';
import SuperAdminScreen from './screens/SuperAdminScreen';

import * as Linking from 'expo-linking';

// Linking configuration
const prefix = Linking.createURL('/');
const linking = {
  prefixes: [prefix],
  config: {
    screens: {
      Home: 'events',
      EventDetail: 'event/:eventId',
      Login: 'login',
      Register: 'register',
      CostalerosList: 'costaleros',
      EventForm: 'event-form',
      QRScanner: 'scan',
      EventTrabajaderas: 'trabajaderas/:eventId',
      Export: 'export',
      RelayManagement: 'relays/:eventId',
      SeasonManagement: 'seasons',
      Measurements: 'measurements/:eventId',
      NotificationsList: 'notifications',
      AttendeeList: 'attendees/:eventId',
      PendingList: 'pending/:eventId',
      CostaleroHistory: 'history',
      CostaleroForm: 'costalero-form',
      SuperAdmin: 'super-admin',
    },
  },
};

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { user, userRole, loading } = useAuth();
  // We need navigation ref or hook inside the component if we use it in screenOptions via a closure, 
  // but screenOptions is passed { navigation } directly by react-navigation.
  // However, defining the inline function below is cleaner if we just assume the prop is passed.
  // Wait, in screenOptions={{ headerLeft: ({ ... }) => ... }}, we don't have access to 'navigation' directly unless we use functional screenOptions.
  // Let's change screenOptions to a function.
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5E35B1" />
      </View>
    );
  }

  if (!user) {
    return (
      <NavigationContainer linking={linking}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={({ navigation }) => ({
          headerTintColor: '#000000',
          headerBackTitleVisible: false,
          headerStyle: { backgroundColor: 'white' },
          headerTitleStyle: { color: '#000000', fontWeight: 'bold' },
          headerShown: true,
          headerLeft: ({ canGoBack, tintColor }) =>
            canGoBack ? (
              <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginLeft: 0, marginRight: 16 }}>
                <MaterialIcons name="arrow-back" size={24} color={tintColor} />
              </TouchableOpacity>
            ) : null
        })}
      >
        {/* PANTALLAS PARA TODOS (Admin, Capataz, Costalero) */}
        <Stack.Screen
          name="Home"
          component={EventsListScreen}
          options={{ title: 'Cuadrilla App' }}
        />
        <Stack.Screen
          name="EventDetail"
          component={EventDetailScreen}
          options={{ title: 'Detalle del Evento' }}
        />
        <Stack.Screen
          name="AttendeeList"
          component={AttendeeListScreen}
          options={{ title: 'Asistentes' }}
        />
        <Stack.Screen
          name="PendingList"
          component={PendingListScreen}
          options={{ title: 'Pendientes' }}
        />
        <Stack.Screen
          name="CostaleroHistory"
          component={CostaleroHistoryScreen}
          options={{ title: 'Historial' }}
        />
        <Stack.Screen
          name="CostaleroForm"
          component={CostaleroFormScreen}
          options={{ title: 'Datos de Costalero' }}
        />

        {/* PANTALLAS SOLO PARA GESTIÓN (SuperAdmin, Admin, Capataz, Auxiliar) */}
        {(userRole === 'superadmin' || userRole === 'admin' || userRole === 'capataz' || userRole === 'auxiliar') && (
          <>
            <Stack.Screen
              name="SuperAdmin"
              component={SuperAdminScreen}
              options={{ title: 'Gestión de Administradores' }}
            />
            <Stack.Screen
              name="CostalerosList"
              component={CostalerosListScreen}
              options={{ title: 'Cuadrilla' }}
            />
            <Stack.Screen
              name="EventForm"
              component={EventFormScreen}
              options={{ title: 'Nuevo Evento' }}
            />
            <Stack.Screen
              name="QRScanner"
              component={QRScannerScreen}
              options={{ title: 'Escanear Asistencia' }}
            />
            <Stack.Screen
              name="EventTrabajaderas"
              component={EventTrabajaderasScreen}
              options={{ title: 'Por Trabajaderas' }}
            />
            <Stack.Screen
              name="Export"
              component={ExportScreen}
              options={{ title: 'Exportar Datos' }}
            />
            <Stack.Screen
              name="RelayManagement"
              component={RelayManagementScreen}
              options={{ title: 'Gestión de Relevos' }}
            />
            <Stack.Screen
              name="SeasonManagement"
              component={SeasonManagementScreen}
              options={{ title: 'Temporadas' }}
            />
            <Stack.Screen
              name="Measurements"
              component={MeasurementScreen}
              options={{ title: 'Mediciones' }}
            />
            <Stack.Screen
              name="NotificationsList"
              component={NotificationsListScreen}
              options={{ title: 'Notificaciones' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SeasonProvider>
      <AuthProvider>
        <NotificationProvider>
          <AppNavigator />
        </NotificationProvider>
      </AuthProvider>
    </SeasonProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA'
  }
});