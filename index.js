import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

// REGISTER SERVICE WORKER FOR PWA PUSH NOTIFICATIONS
if (Platform.OS === 'web' && 'serviceWorker' in navigator) {
    window.addEventListener('load', function () {
        navigator.serviceWorker.register('/service-worker.js').then(function (registration) {
            console.log('Service Worker registered with scope: ', registration.scope);
        }, function (err) {
            console.log('Service Worker registration failed: ', err);
        });
    });
}
