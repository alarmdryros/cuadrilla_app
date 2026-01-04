import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseConfig';

const SeasonContext = createContext({});

export const SeasonProvider = ({ children }) => {
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [availableYears, setAvailableYears] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSeasonConfig();
    }, []);

    const loadSeasonConfig = async () => {
        setLoading(true);
        try {
            // 1. Obtener el año actual configurado en la DB
            const { data: configData, error: configError } = await supabase
                .from('configuracion')
                .select('value')
                .eq('key', 'año_actual')
                .single();

            if (configData) {
                const year = parseInt(configData.value, 10);
                setCurrentYear(year);
                // Solo asignar selectedYear si es la primera carga (loading es true)
                // Esto evita que saltos de red o refrescos internos cambien el año que el usuario está viendo
                setSelectedYear(prev => (loading || !prev) ? year : prev);
            }

            // 2. Obtener lista de todos los años con datos (para el selector)
            // Hacemos una consulta rápida a costaleros para ver qué años existen
            const { data: yearsData, error: yearsError } = await supabase
                .from('costaleros')
                .select('año');

            if (yearsData) {
                const years = [...new Set(yearsData.map(item => item.año))].sort((a, b) => b - a);
                // Si la tabla está vacía o solo tiene el actual, aseguramos que al menos el año actual esté
                if (years.length === 0) {
                    setAvailableYears([new Date().getFullYear()]);
                } else {
                    setAvailableYears(years);
                }
            }
        } catch (error) {
            console.error('Error loading season config:', error);
        } finally {
            setLoading(false);
        }
    };

    const changeSelectedYear = (year) => {
        setSelectedYear(year);
    };

    const value = {
        selectedYear,
        currentYear,
        availableYears,
        loading,
        changeSelectedYear,
        refreshSeasons: loadSeasonConfig
    };

    return <SeasonContext.Provider value={value}>{children}</SeasonContext.Provider>;
};

export const useSeason = () => {
    const context = useContext(SeasonContext);
    if (!context) {
        throw new Error('useSeason must be used within SeasonProvider');
    }
    return context;
};
