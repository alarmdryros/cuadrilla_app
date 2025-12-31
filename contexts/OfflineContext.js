import React, { createContext, useState, useEffect, useContext } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { OfflineService } from '../services/OfflineService';
import { Alert } from 'react-native';

const OfflineContext = createContext({});

export const OfflineProvider = ({ children }) => {
    const [isOffline, setIsOffline] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [queueSize, setQueueSize] = useState(0);

    useEffect(() => {
        // Subscribe to network state changes
        const unsubscribe = NetInfo.addEventListener(state => {
            const offline = state.isConnected === false || state.isInternetReachable === false;
            setIsOffline(offline);

            if (!offline) {
                handleReconnect();
            }
        });

        // Initial check
        checkQueue();

        return () => unsubscribe();
    }, []);

    const checkQueue = async () => {
        const queue = await OfflineService.getSyncQueue();
        setQueueSize(queue.length);
    };

    const handleReconnect = async () => {
        const queue = await OfflineService.getSyncQueue();
        if (queue.length > 0) {
            setIsSyncing(true);
            const success = await OfflineService.processSyncQueue();
            setIsSyncing(false);
            setQueueSize(0);

            if (success) {
                // Optional: Notify user
                console.log('Datos sincronizados automáticamente.');
            }
        }
    };

    const addMutation = async (operation) => {
        const size = await OfflineService.addToSyncQueue(operation);
        setQueueSize(size);
        if (!isOffline) {
            handleReconnect();
        }
    };

    const value = {
        isOffline,
        isSyncing,
        queueSize,
        addMutation,
        checkQueue
    };

    return (
        <OfflineContext.Provider value={value}>
            {children}
        </OfflineContext.Provider>
    );
};

export const useOffline = () => {
    const context = useContext(OfflineContext);
    if (!context) {
        throw new Error('useOffline must be used within OfflineProvider');
    }
    return context;
};
