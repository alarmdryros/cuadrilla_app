import React from 'react';
import { View, ActivityIndicator, StyleSheet, TouchableOpacity, Text, Platform, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from './components/Icon';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SeasonProvider } from './contexts/SeasonContext';
import { OfflineProvider } from './contexts/OfflineContext';
import { NotificationProvider } from './contexts/NotificationContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Screens
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import CostalerosListScreen from './screens/CostalerosListScreen';
import CostaleroFormScreen from './screens/CostaleroFormScreen';
import AnnouncementsScreen from './screens/AnnouncementsScreen';
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
import SuperAdminScreen from './screens/SuperAdminScreen';
import DashboardScreen from './screens/DashboardScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import DatosPalioScreen from './screens/DatosPalioScreen';

import * as Linking from 'expo-linking';

// Linking configuration
const prefix = Linking.createURL('/');
const linking = {
  prefixes: [prefix],
  config: {
    screens: {
      MainTabs: {
        screens: {
          Dashboard: 'home',
          Announcements: 'board',
          EventsList: 'events',
          Management: 'management',
          Profile: 'profile',
        }
      },
      Onboarding: 'welcome',
      EventDetail: 'event/:eventId',
      Login: 'login',
      Register: 'register',
      EventForm: 'event-form',
      QRScanner: 'scan',
      EventTrabajaderas: 'trabajaderas/:eventId',
      Export: 'export',
      RelayManagement: 'relays/:eventId',
      SeasonManagement: 'seasons',
      Measurements: 'measurements/:eventId',
      AttendeeList: 'attendees/:eventId',
      PendingList: 'pending/:eventId',
      CostaleroForm: 'costalero-form',
      SuperAdmin: 'super-admin',
    },
  },
};

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabNavigator() {
  const { userRole } = useAuth();
  const insets = useSafeAreaInsets();
  const isManagement = ['superadmin', 'admin', 'capataz', 'auxiliar'].includes(userRole?.toLowerCase());

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Dashboard') iconName = 'home';
          else if (route.name === 'Announcements') iconName = 'event-note';
          else if (route.name === 'EventsList') iconName = 'event';
          else if (route.name === 'Management') iconName = 'people';
          else if (route.name === 'Profile') iconName = 'person';

          return <MaterialIcons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#1a5d1a',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'white',
          borderTopWidth: 1,
          borderTopColor: '#E0E0E0',
          height: Platform.OS === 'ios' ? 88 : 54,
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : 0,
          paddingTop: 4,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginBottom: Platform.OS === 'ios' ? 0 : 2,
        }
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: 'Inicio',
          headerShown: true,
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: 'white', elevation: 0, shadowOpacity: 0 },
        }}
      />
      <Tab.Screen
        name="Announcements"
        component={AnnouncementsScreen}
        options={{
          title: 'Tablón',
          headerShown: true,
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: 'white', elevation: 0, shadowOpacity: 0 },
        }}
      />
      <Tab.Screen
        name="EventsList"
        component={EventsListScreen}
        options={{
          title: 'Eventos',
          headerShown: true,
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: 'white', elevation: 0, shadowOpacity: 0 },
        }}
      />
      {isManagement ? (
        <Tab.Screen
          name="Management"
          component={CostalerosListScreen}
          options={{
            title: 'Cuadrilla',
            headerShown: true,
            headerTitleAlign: 'center',
            headerStyle: { backgroundColor: 'white', elevation: 0, shadowOpacity: 0 },
          }}
        />
      ) : (
        <Tab.Screen
          name="Profile"
          component={CostaleroFormScreen}
          options={{
            title: 'Mi Perfil',
            headerShown: true,
            headerTitleAlign: 'center',
            headerStyle: { backgroundColor: 'white', elevation: 0, shadowOpacity: 0 },
          }}
          initialParams={{ readOnly: true }}
        />
      )}
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { user, userRole, loading } = useAuth();
  const [showOnboarding, setShowOnboarding] = React.useState(null);

  React.useEffect(() => {
    if (user) {
      const checkOnboarding = async () => {
        try {
          const hasSeen = await AsyncStorage.getItem('hasSeenOnboarding');
          setShowOnboarding(hasSeen !== 'true');
        } catch (e) {
          setShowOnboarding(false);
        }
      };
      checkOnboarding();
    } else {
      setShowOnboarding(null);
    }
  }, [user]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1a5d1a" />
      </View>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }} edges={['right', 'bottom', 'left']}>
        <NavigationContainer linking={linking}>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaView>
    );
  }

  if (showOnboarding === null && user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1a5d1a" />
      </View>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: 'white' }}
      edges={['top', 'right', 'bottom', 'left']}
    >
      <NavigationContainer linking={linking}>
        <Stack.Navigator
          initialRouteName={showOnboarding ? "Onboarding" : "MainTabs"}
          screenOptions={({ navigation }) => ({
            headerTintColor: '#000000',
            headerBackTitleVisible: false,
            headerStyle: { backgroundColor: 'white' },
            headerTitleStyle: { color: '#000000', fontWeight: 'bold' },
            headerShown: true,
            headerLeft: ({ canGoBack, tintColor }) =>
              canGoBack ? (
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginLeft: 0, marginRight: 16 }}>
                  <MaterialIcons name="arrow-back" size={24} color={tintColor || "#000000"} />
                </TouchableOpacity>
              ) : null
          })}
        >
          <Stack.Screen
            name="Onboarding"
            component={OnboardingScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="MainTabs"
            component={TabNavigator}
            options={{ headerShown: false }}
          />

          {/* PANTALLAS DE DETALLE / FORMULARIO */}
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

          {/* PANTALLAS SOLO PARA GESTIÓN */}
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
                name="DatosPalio"
                component={DatosPalioScreen}
                options={{ title: 'Datos Palio' }}
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
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SeasonProvider>
        <AuthProvider>
          <OfflineProvider>
            <NotificationProvider>
              <StatusBar barStyle="dark-content" backgroundColor="white" translucent={true} />
              <AppNavigator />
            </NotificationProvider>
          </OfflineProvider>
        </AuthProvider>
      </SeasonProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  }
});
