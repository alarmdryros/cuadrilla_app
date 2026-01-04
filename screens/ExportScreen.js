import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../supabaseConfig';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as XLSX from 'xlsx';
import QRCode from 'qrcode';
import { MaterialIcons } from '../components/Icon';
import { useSeason } from '../contexts/SeasonContext';

export default function ExportScreen() {
    const [loading, setLoading] = useState(false);
    const [events, setEvents] = useState([]);
    const [showEventSelector, setShowEventSelector] = useState(false);
    const { selectedYear } = useSeason();

    React.useEffect(() => {
        fetchEvents();
    }, [selectedYear]);

    const fetchEvents = async () => {
        try {
            const { data, error } = await supabase
                .from('eventos')
                .select('*')
                .eq('año', selectedYear)
                .order('fecha', { ascending: false });

            if (error) throw error;
            setEvents(data || []);
        } catch (error) {
            console.error('Error fetching events:', error);
        }
    };

    const generateCSV = (headers, rows) => {
        const csvHeaders = headers.join(',');
        const csvRows = rows.map(row =>
            row.map(cell => {
                // Fix: ensure cell 0 is not treated as empty string
                if (cell === 0 || cell === '0') return '0';
                const cellStr = String(cell || '');
                if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                    return `"${cellStr.replace(/"/g, '""')}"`;
                }
                return cellStr;
            }).join(',')
        );
        return [csvHeaders, ...csvRows].join('\n');
    };

    const shareCSV = async (csvContent, filename) => {
        try {
            const fileUri = FileSystem.documentDirectory + filename;
            const contentWithBOM = '\uFEFF' + csvContent;
            await FileSystem.writeAsStringAsync(fileUri, contentWithBOM, {
                encoding: 'utf8',
            });

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri, {
                    mimeType: 'text/csv',
                    dialogTitle: 'Exportar Datos',
                    UTI: 'public.comma-separated-values-text'
                });
            } else {
                Alert.alert('Error', 'No se puede compartir archivos en este dispositivo');
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Error al generar el archivo: ' + error.message);
        }
    };

    const exportCostaleros = async () => {
        setLoading(true);
        try {
            const { data: costaleros, error } = await supabase
                .from('costaleros')
                .select('*')
                .eq('año', selectedYear)
                .order('apellidos');

            if (error) throw error;

            const headers = ['Apellidos', 'Nombre', 'Trabajadera', 'Puesto', 'Altura (m)', 'Suplemento', 'Fecha Ingreso', 'Teléfono', 'Email'];
            const rows = costaleros.map(data => [
                data.apellidos || '',
                data.nombre || '',
                data.trabajadera || '',
                data.puesto || '',
                data.altura || '',
                data.suplemento || '',
                data.fechaIngreso || '',
                data.telefono || '',
                data.email || ''
            ]);

            const csv = generateCSV(headers, rows);
            await shareCSV(csv, `costaleros_${selectedYear}_${new Date().toISOString().split('T')[0]}.csv`);
            Alert.alert('Éxito', `${rows.length} costaleros exportados`);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const exportAllEvents = async () => {
        setLoading(true);
        try {
            // 1. Fetch all costaleros for this year once to get total cuadrilla
            const { data: allCostaleros } = await supabase
                .from('costaleros')
                .select('id')
                .eq('año', selectedYear);

            const totalCuadrilla = allCostaleros?.length || 0;

            // 2. Fetch all events for this year
            const { data: events, error: eventsError } = await supabase
                .from('eventos')
                .select('*')
                .eq('año', selectedYear)
                .order('fecha', { ascending: false });

            if (eventsError) throw eventsError;

            // 3. Fetch all attendance for these events in one batch
            const eventIds = events.map(e => e.id);
            const { data: seasonAsistencias } = await supabase
                .from('asistencias')
                .select('event_id, costalero_id, status, timestamp')
                .in('event_id', eventIds);

            const headers = ['Evento', 'Fecha', 'Lugar', 'Total Cuadrilla', 'Presentes', 'Ausentes', 'Justificados', '% Asistencia'];
            const rows = [];

            for (const eventData of events) {
                // Filter attendance for this specific event
                const eventAsis = (seasonAsistencias || []).filter(a => a.event_id === eventData.id);

                // Deduplicate by costalero_id (keep the newest status for each person)
                const uniqueAsisMap = eventAsis.reduce((acc, a) => {
                    if (!acc[a.costalero_id] || new Date(a.timestamp) > new Date(acc[a.costalero_id].timestamp)) {
                        acc[a.costalero_id] = a;
                    }
                    return acc;
                }, {});
                const uniqueAsis = Object.values(uniqueAsisMap);

                let presentes = 0, ausentes = 0, justificados = 0;
                uniqueAsis.forEach(record => {
                    const statusVal = record.status?.toLowerCase();
                    if (statusVal === 'presente') presentes++;
                    else if (statusVal === 'ausente') ausentes++;
                    else if (statusVal === 'justificado') justificados++;
                });

                const porcentaje = totalCuadrilla > 0 ? Math.round((presentes / totalCuadrilla) * 100) : 0;

                rows.push([
                    eventData.nombre || '',
                    eventData.fecha ? new Date(eventData.fecha).toLocaleDateString() : '',
                    eventData.lugar || '',
                    totalCuadrilla,
                    presentes,
                    ausentes,
                    justificados,
                    `${porcentaje}%`
                ]);
            }

            const csv = generateCSV(headers, rows);
            await shareCSV(csv, `resumen_eventos_${selectedYear}.csv`);
            Alert.alert('Éxito', `${rows.length} eventos exportados`);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const exportAttendanceMatrix = async () => {
        setLoading(true);
        try {
            // 1. Fetch costaleros
            const { data: costaleros } = await supabase
                .from('costaleros')
                .select('id, nombre, apellidos, trabajadera')
                .eq('año', selectedYear)
                .order('trabajadera', { ascending: true })
                .order('apellidos', { ascending: true });

            // 2. Fetch events
            const { data: events } = await supabase
                .from('eventos')
                .select('id, nombre, fecha')
                .eq('año', selectedYear)
                .order('fecha', { ascending: true });

            // 3. Fetch all attendance for this year
            const eventIds = events.map(e => e.id);
            const { data: allAsistencias } = await supabase
                .from('asistencias')
                .select('costalero_id, event_id, status')
                .in('event_id', eventIds);

            // 4. Build Matrix
            const eventHeaders = events.map(e => `${e.nombre} (${new Date(e.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })})`);
            const headers = ['Trabajadera', 'Apellidos', 'Nombre', ...eventHeaders];

            const rows = costaleros.map(c => {
                const row = [c.trabajadera || '0', c.apellidos || '', c.nombre || ''];
                events.forEach(e => {
                    const asist = allAsistencias?.find(a => a.costalero_id === c.id && a.event_id === e.id);
                    let val = '-';
                    if (asist) {
                        if (asist.status === 'presente') val = 'P';
                        else if (asist.status === 'ausente') val = 'A';
                        else if (asist.status === 'justificado') val = 'J';
                    }
                    row.push(val);
                });
                return row;
            });

            const csv = generateCSV(headers, rows);
            await shareCSV(csv, `matriz_asistencia_${selectedYear}.csv`);
            Alert.alert('Éxito', 'Matriz de asistencia generada correctamente');
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'No se pudo generar la matriz');
        } finally {
            setLoading(false);
        }
    };

    const printQRReport = async () => {
        setLoading(true);
        try {
            const { data: costaleros, error } = await supabase
                .from('costaleros')
                .select('*')
                .eq('año', selectedYear)
                .order('trabajadera');

            if (error) throw error;

            const { data: events } = await supabase
                .from('eventos')
                .select('*')
                .eq('año', selectedYear)
                .order('fecha', { ascending: true });

            const eventIds = events?.map(e => e.id) || [];
            const { data: allAsis } = await supabase
                .from('asistencias')
                .select('*')
                .in('event_id', eventIds);

            let costalerosWithQR = [];
            for (const data of costaleros) {
                const id = data.id;
                try {
                    const svgString = await QRCode.toString(id, { type: 'svg', margin: 1 });
                    costalerosWithQR.push({ ...data, qrSVG: svgString });
                } catch (e) {
                    costalerosWithQR.push({ ...data, qrSVG: null });
                }
            }

            const html = `
            <!DOCTYPE html>
            <html>
                <head>
                    <style>
                        body { font-family: 'Helvetica', sans-serif; padding: 20px; background-color: white; }
                        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #5E35B1; padding-bottom: 10px; }
                        .year-tag { color: #5E35B1; font-weight: bold; }
                        .card { 
                            border: 1px solid #EEE; 
                            padding: 15px; 
                            margin-bottom: 20px; 
                            text-align: center; 
                            page-break-inside: avoid;
                            border-radius: 12px;
                            background-color: #FAFAFA;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                        }
                        svg { width: 160px !important; height: 160px !important; margin: 10px auto; display: block; }
                        .name { font-size: 18px; font-weight: bold; color: #212121; margin-bottom: 2px; }
                        .meta { font-size: 14px; color: #757575; margin-bottom: 5px; }
                        .section-title { 
                            background-color: #5E35B1; 
                            color: white; 
                            padding: 8px; 
                            font-size: 16px; 
                            margin: 30px 0 15px 0;
                            text-align: center;
                            font-weight: bold;
                            border-radius: 6px;
                            page-break-after: avoid;
                        }
                        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>Listado de Códigos QR</h1>
                        <div class="year-tag">TEMPORADA ${selectedYear}</div>
                    </div>
                    ${generateCostalerosHTML(costalerosWithQR)}
                </body>
            </html>
            `;

            const { uri } = await Print.printToFileAsync({ html });
            await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
        } catch (error) {
            console.error(error);
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const exportAdvancedSeasonReport = async () => {
        setLoading(true);
        try {
            // 1. Fetch all data
            const { data: costaleros } = await supabase.from('costaleros').select('id').eq('año', selectedYear);
            const { data: events } = await supabase.from('eventos').select('*').eq('año', selectedYear).order('fecha', { ascending: true });
            const eventIds = events.map(e => e.id);
            const { data: allAsis } = await supabase.from('asistencias').select('*').in('event_id', eventIds);

            const totalCuadrilla = costaleros?.length || 0;
            let totalPresenciasGlobal = 0;

            const eventStats = events.map(event => {
                const eventAsis = (allAsis || []).filter(a => a.event_id === event.id);
                // Deduplicate
                const uniqueAsisMap = eventAsis.reduce((acc, a) => {
                    if (!acc[a.costalero_id] || new Date(a.timestamp) > new Date(acc[a.costalero_id].timestamp)) {
                        acc[a.costalero_id] = a;
                    }
                    return acc;
                }, {});
                const uniqueList = Object.values(uniqueAsisMap);

                const presentes = uniqueList.filter(a => a.status === 'presente').length;
                const ausentes = uniqueList.filter(a => a.status === 'ausente').length;
                const justificados = uniqueList.filter(a => a.status === 'justificado').length;
                totalPresenciasGlobal += presentes;

                return {
                    ...event,
                    presentes,
                    ausentes,
                    justificados,
                    porcentaje: totalCuadrilla > 0 ? Math.round((presentes / totalCuadrilla) * 100) : 0
                };
            });

            const avgAsistencia = events.length > 0 ? Math.round(eventStats.reduce((acc, curr) => acc + curr.porcentaje, 0) / events.length) : 0;

            const html = `
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; margin: 0; padding: 40px; background: white; }
                        .header { text-align: center; margin-bottom: 40px; border-bottom: 3px solid #5E35B1; padding-bottom: 20px; }
                        .app-name { font-size: 14px; color: #5E35B1; text-transform: uppercase; letter-spacing: 2px; font-weight: bold; margin-bottom: 5px; }
                        .title { fontSize: 28px; font-weight: 800; color: #212121; margin: 0; }
                        .season { font-size: 18px; color: #757575; margin-top: 5px; }
                        
                        .dashboard { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 40px; }
                        .stat-card { background: #F8F9FF; border: 1px solid #EDE7F6; padding: 20px; border-radius: 12px; text-align: center; }
                        .stat-value { font-size: 24px; font-weight: 800; color: #5E35B1; display: block; }
                        .stat-label { font-size: 12px; color: #757575; text-transform: uppercase; letter-spacing: 1px; margin-top: 5px; font-weight: 600; }
                        
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th { background: #5E35B1; color: white; text-align: left; padding: 12px 15px; font-size: 13px; text-transform: uppercase; }
                        td { padding: 12px 15px; border-bottom: 1px solid #EEE; font-size: 14px; }
                        .row-even { background: #FAFAFA; }
                        .status-badge { padding: 4px 8px; borderRadius: 4px; font-weight: bold; font-size: 12px; }
                        .perc-high { color: #2E7D32; font-weight: bold; }
                        .perc-low { color: #D32F2F; font-weight: bold; }
                        
                        .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #9E9E9E; border-top: 1px solid #EEE; padding-top: 20px; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="app-name">Cuadrilla App Premium</div>
                        <h1 class="title">Resumen Avanzado de Temporada</h1>
                        <div class="season">Temporada ${selectedYear}</div>
                    </div>

                    <div class="dashboard">
                        <div class="stat-card">
                            <span class="stat-value">${events.length}</span>
                            <span class="stat-label">Eventos Totales</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-value">${totalCuadrilla}</span>
                            <span class="stat-label">Costaleros</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-value">${avgAsistencia}%</span>
                            <span class="stat-label">Asistencia Media</span>
                        </div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>Evento</th>
                                <th>Fecha</th>
                                <th style="text-align: center;">Pres.</th>
                                <th style="text-align: center;">Aus.</th>
                                <th style="text-align: center;">Just.</th>
                                <th style="text-align: center;">% Asist.</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${eventStats.map((e, index) => `
                                <tr class="${index % 2 === 0 ? '' : 'row-even'}">
                                    <td><strong>${e.nombre}</strong><br/><small style="color: #9E9E9E">${e.lugar || '-'}</small></td>
                                    <td>${e.fecha ? new Date(e.fecha).toLocaleDateString() : '-'}</td>
                                    <td style="text-align: center; color: #2E7D32; font-weight: bold;">${e.presentes}</td>
                                    <td style="text-align: center; color: #D32F2F;">${e.ausentes}</td>
                                    <td style="text-align: center; color: #EF6C00;">${e.justificados}</td>
                                    <td style="text-align: center;" class="${e.porcentaje >= 80 ? 'perc-high' : e.porcentaje < 50 ? 'perc-low' : ''}">
                                        ${e.porcentaje}%
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <div class="footer">
                        Informe generado automáticamente el ${new Date().toLocaleDateString()} a las ${new Date().toLocaleTimeString()} <br/>
                        &copy; ${new Date().getFullYear()} Cuadrilla App - Gestión Inteligente para Hermandades
                    </div>
                </body>
            </html>
            `;

            const { uri } = await Print.printToFileAsync({ html });
            await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });

        } catch (error) {
            console.error(error);
            Alert.alert("Error", "No se pudo generar el informe avanzado.");
        } finally {
            setLoading(false);
        }
    };

    const exportDetailedAttendanceReport = async () => {
        setLoading(true);
        try {
            // 1. Fetch all data
            const { data: costaleros } = await supabase
                .from('costaleros')
                .select('*')
                .eq('año', selectedYear)
                .order('trabajadera', { ascending: true })
                .order('apellidos', { ascending: true });

            const { data: events } = await supabase
                .from('eventos')
                .select('*')
                .eq('año', selectedYear)
                .order('fecha', { ascending: true });

            const eventIds = events.map(e => e.id);
            const { data: allAsis } = await supabase
                .from('asistencias')
                .select('*')
                .in('event_id', eventIds);

            if (!events || events.length === 0) {
                Alert.alert("Aviso", "No hay eventos registrados en esta temporada.");
                return;
            }

            const html = `
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; margin: 0; padding: 0; background: white; }
                        .page { padding: 40px; page-break-after: always; min-height: 90vh; }
                        .header { border-bottom: 2px solid #5E35B1; padding-bottom: 15px; margin-bottom: 25px; }
                        .event-name { font-size: 24px; font-weight: 800; color: #212121; margin: 0; text-transform: uppercase; }
                        .event-meta { font-size: 14px; color: #757575; margin-top: 5px; font-weight: 500; }
                        
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                        th { background: #F5F5F5; color: #616161; text-align: left; padding: 10px 12px; font-size: 11px; text-transform: uppercase; border-bottom: 2px solid #EEE; }
                        td { padding: 8px 12px; border-bottom: 1px solid #F0F0F0; font-size: 13px; }
                        
                        .status { font-weight: bold; text-transform: uppercase; font-size: 11px; }
                        .presente { color: #2E7D32; }
                        .ausente { color: #D32F2F; }
                        .justificado { color: #EF6C00; }
                        .pendientes { color: #9E9E9E; font-style: italic; }
                        
                        .trabajadera-col { width: 40px; text-align: center; }
                        .puesto-col { width: 120px; color: #5E35B1; font-weight: 600; }
                        .costalero-col { font-weight: 600; }
                        
                        .footer { position: fixed; bottom: 20px; width: 100%; text-align: center; font-size: 9px; color: #BDBDBD; }
                    </style>
                </head>
                <body>
                    ${events.map(event => {
                const eventAsis = (allAsis || []).filter(a => a.event_id === event.id);

                // Deduplicate attendance
                const uniqueAsisMap = eventAsis.reduce((acc, a) => {
                    if (!acc[a.costalero_id] || new Date(a.timestamp) > new Date(acc[a.costalero_id].timestamp)) {
                        acc[a.costalero_id] = a;
                    }
                    return acc;
                }, {});

                return `
                        <div class="page">
                            <div class="header">
                                <h1 class="event-name">${event.nombre}</h1>
                                <div class="event-meta">
                                    📅 ${event.fecha ? new Date(event.fecha).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '-'} 
                                    &nbsp; | &nbsp; 📍 ${event.lugar || 'Lugar no especificado'}
                                </div>
                            </div>

                            <table>
                                <thead>
                                    <tr>
                                        <th class="trabajadera-col">T.</th>
                                        <th class="puesto-col">Puesto</th>
                                        <th class="costalero-col">Costalero</th>
                                        <th>Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${costaleros.map(c => {
                    const attendance = uniqueAsisMap[c.id];
                    const status = attendance ? attendance.status?.toLowerCase() : 'pendiente';
                    const statusLabel = status === 'presente' ? '✅ PRESENTE' :
                        status === 'ausente' ? '❌ AUSENTE' :
                            status === 'justificado' ? '📝 JUSTIFICADO' : '⏳ SIN REGISTRO';
                    const statusClass = status === 'presente' ? 'presente' :
                        status === 'ausente' ? 'ausente' :
                            status === 'justificado' ? 'justificado' : 'pendientes';

                    return `
                                        <tr>
                                            <td class="trabajadera-col">${c.trabajadera || '-'}</td>
                                            <td class="puesto-col">${c.puesto || '-'}</td>
                                            <td class="costalero-col">${c.nombre} ${c.apellidos}</td>
                                            <td class="status ${statusClass}">${statusLabel}</td>
                                        </tr>
                                        `;
                }).join('')}
                                </tbody>
                            </table>
                            <div class="footer">Libro de Actas Detallado - Temporada ${selectedYear} - Generado por Cuadrilla App</div>
                        </div>
                        `;
            }).join('')}
                </body>
            </html>
            `;

            const { uri } = await Print.printToFileAsync({ html });
            await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });

        } catch (error) {
            console.error(error);
            Alert.alert("Error", "No se pudo generar el libro de actas detallado.");
        } finally {
            setLoading(false);
        }
    };

    const exportDetailedAttendanceCSV = async () => {
        setLoading(true);
        try {
            // 1. Fetch all data
            const { data: costaleros } = await supabase
                .from('costaleros')
                .select('*')
                .eq('año', selectedYear)
                .order('trabajadera', { ascending: true })
                .order('apellidos', { ascending: true });

            const { data: events } = await supabase
                .from('eventos')
                .select('*')
                .eq('año', selectedYear)
                .order('fecha', { ascending: true });

            const eventIds = events.map(e => e.id);
            const { data: allAsis } = await supabase
                .from('asistencias')
                .select('*')
                .in('event_id', eventIds);

            if (!events || events.length === 0) {
                Alert.alert("Aviso", "No hay eventos registrados en esta temporada.");
                return;
            }

            const headers = ['Evento', 'Fecha', 'Lugar', 'Trabajadera', 'Puesto', 'Costalero', 'Estado'];
            const rows = [];

            events.forEach(event => {
                const eventAsis = (allAsis || []).filter(a => a.event_id === event.id);
                // Deduplicate attendance
                const uniqueAsisMap = eventAsis.reduce((acc, a) => {
                    if (!acc[a.costalero_id] || new Date(a.timestamp) > new Date(acc[a.costalero_id].timestamp)) {
                        acc[a.costalero_id] = a;
                    }
                    return acc;
                }, {});

                costaleros.forEach(c => {
                    const attendance = uniqueAsisMap[c.id];
                    const status = attendance ? (attendance.status?.toUpperCase() || 'PRESENTE') : 'SIN REGISTRO';

                    rows.push([
                        event.nombre || '',
                        event.fecha ? new Date(event.fecha).toLocaleDateString() : '',
                        event.lugar || '',
                        c.trabajadera || '-',
                        c.puesto || '-',
                        `${c.nombre} ${c.apellidos}`,
                        status
                    ]);
                });
            });

            const csv = generateCSV(headers, rows);
            await shareCSV(csv, `libro_actas_detallado_${selectedYear}.csv`);
            Alert.alert('Éxito', `Exportadas ${rows.length} filas de datos.`);

        } catch (error) {
            console.error(error);
            Alert.alert("Error", "No se pudo generar el CSV detallado.");
        } finally {
            setLoading(false);
        }
    };

    const handleExcelExport = (eventId = null) => {
        setShowEventSelector(false);
        exportDetailedAttendanceXLSX(eventId);
    };

    const exportDetailedAttendanceXLSX = async (specificEventId = null) => {
        setLoading(true);
        try {
            // 0. Find specific event if needed
            const specificEvent = specificEventId ? events.find(e => e.id === specificEventId) : null;

            // 1. Fetch all data
            const { data: costaleros } = await supabase
                .from('costaleros')
                .select('*')
                .eq('año', selectedYear)
                .order('trabajadera', { ascending: true })
                .order('apellidos', { ascending: true });

            const eventsToExport = specificEventId
                ? [specificEvent]
                : events.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

            const eventIds = eventsToExport.filter(e => e).map(e => e.id);
            if (eventIds.length === 0) {
                Alert.alert("Aviso", "No hay eventos seleccionados para exportar.");
                return;
            }

            const { data: allAsis } = await supabase
                .from('asistencias')
                .select('*')
                .in('event_id', eventIds);

            // 2. Create Workbook
            const wb = XLSX.utils.book_new();

            // 2.1 CREATE MASTER DATA SHEET (for Pivot Tables) - Only for Collective
            if (!specificEventId) {
                const masterData = [
                    ['Evento', 'Fecha', 'Trabajadera', 'Costalero', 'Puesto', 'Estado']
                ];

                eventsToExport.forEach(event => {
                    const eventAsis = (allAsis || []).filter(a => a.event_id === event.id);
                    const uniqueAsisMap = eventAsis.reduce((acc, a) => {
                        if (!acc[a.costalero_id] || new Date(a.timestamp) > new Date(acc[a.costalero_id].timestamp)) {
                            acc[a.costalero_id] = a;
                        }
                        return acc;
                    }, {});

                    costaleros.forEach(c => {
                        const attendance = uniqueAsisMap[c.id];
                        const status = attendance ? (attendance.status?.toUpperCase() || 'PRESENTE') : 'SIN REGISTRO';

                        masterData.push([
                            event.nombre || '',
                            event.fecha ? new Date(event.fecha).toLocaleDateString() : '',
                            c.trabajadera || '-',
                            `${c.nombre} ${c.apellidos}`,
                            c.puesto || '-',
                            status
                        ]);
                    });
                });

                const wsMaster = XLSX.utils.aoa_to_sheet(masterData);
                XLSX.utils.book_append_sheet(wb, wsMaster, "BASE_DE_DATOS");
            }

            // 2.2 CREATE INDIVIDUAL EVENT SHEETS
            eventsToExport.forEach(event => {
                if (!event) return;
                const eventAsis = (allAsis || []).filter(a => a.event_id === event.id);
                // Deduplicate attendance
                const uniqueAsisMap = eventAsis.reduce((acc, a) => {
                    if (!acc[a.costalero_id] || new Date(a.timestamp) > new Date(acc[a.costalero_id].timestamp)) {
                        acc[a.costalero_id] = a;
                    }
                    return acc;
                }, {});

                // Prepare sheet data
                const wsData = [
                    ['EVENTO:', event.nombre || ''],
                    ['FECHA:', event.fecha ? new Date(event.fecha).toLocaleDateString() : ''],
                    ['LUGAR:', event.lugar || ''],
                    [], // Empty row
                    ['Trabajadera', 'Costalero', 'Puesto', 'Estado']
                ];

                costaleros.forEach(c => {
                    const attendance = uniqueAsisMap[c.id];
                    const status = attendance ? (attendance.status?.toUpperCase() || 'PRESENTE') : 'SIN REGISTRO';

                    wsData.push([
                        c.trabajadera || '-',
                        `${c.nombre} ${c.apellidos}`,
                        c.puesto || '-',
                        status
                    ]);
                });

                // Create worksheet
                const ws = XLSX.utils.aoa_to_sheet(wsData);

                // Sanitize sheet name
                let sheetName = (event.nombre || 'Evento').substring(0, 31).replace(/[\[\]\*\?\/\\:]/g, ' ');

                // Ensure unique sheet names
                let finalName = sheetName;
                let counter = 1;
                while (wb.SheetNames.includes(finalName)) {
                    finalName = `${sheetName.substring(0, 28)} (${counter++})`;
                }

                XLSX.utils.book_append_sheet(wb, ws, finalName);
            });

            // 3. Export to Base64
            const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

            // 4. Save and Share
            const eventNamePart = specificEvent ? specificEvent.nombre.replace(/\s+/g, '_') : 'DETALLADO';
            const datePart = specificEvent && specificEvent.fecha ? specificEvent.fecha.split('T')[0] : selectedYear;
            const fileName = `Libro_Actas_${eventNamePart}_${datePart}.xlsx`;
            const fileUri = `${FileSystem.documentDirectory}${fileName}`;

            await FileSystem.writeAsStringAsync(fileUri, wbout, {
                encoding: FileSystem.EncodingType.Base64
            });

            await Sharing.shareAsync(fileUri, {
                UTI: 'com.microsoft.excel.xlsx',
                mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });

            Alert.alert('Éxito', specificEventId ? `Excel de "${specificEvent.nombre}" generado.` : 'Excel generado correctamente con una hoja por evento.');

        } catch (error) {
            console.error(error);
            Alert.alert("Error", "No se pudo generar el archivo Excel.");
        } finally {
            setLoading(false);
        }
    };

    const generateCostalerosHTML = (list) => {
        const grouped = { '1': [], '2': [], '3': [], '4': [], '5': [], '6': [], '7': [], '0': [] };
        list.forEach(c => {
            const t = c.trabajadera && grouped[c.trabajadera] ? c.trabajadera : '0';
            grouped[t].push(c);
        });

        let htmlContent = '';
        const tNames = { '1': 'Trabajadera 1', '2': 'Trabajadera 2', '3': 'Trabajadera 3', '4': 'Trabajadera 4', '5': 'Trabajadera 5', '6': 'Trabajadera 6', '7': 'Trabajadera 7', '0': 'Sin Asignar' };

        Object.keys(grouped).forEach(key => {
            const group = grouped[key];
            if (group.length > 0) {
                htmlContent += `<div class="section-title">${tNames[key]}</div>`;
                htmlContent += `<div class="grid">`;
                group.forEach(c => {
                    htmlContent += `
                        <div class="card">
                            <div class="name">${c.nombre} ${c.apellidos}</div>
                            <div class="meta">${c.puesto || 'Costalero'}</div>
                            ${c.qrSVG || '<div>Error QR</div>'}
                            <div style="font-size: 10px; color: #BDBDBD; margin-top: 5px; font-family: monospace;">${c.id}</div>
                        </div>
                    `;
                });
                htmlContent += `</div>`;
            }
        });
        return htmlContent;
    };

    const ExportCard = ({ icon, title, description, onPress, btnText, color = '#5E35B1' }) => (
        <View style={styles.card}>
            <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
                <MaterialIcons name={icon} size={32} color={color} />
            </View>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.cardDescription}>{description}</Text>
            <TouchableOpacity
                style={[styles.exportButton, { backgroundColor: color }]}
                onPress={onPress}
                disabled={loading}
            >
                <Text style={styles.exportButtonText}>
                    {loading ? 'Procesando...' : btnText}
                </Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={{ flex: 1 }}>
            <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Text style={styles.title}>Exportar Datos</Text>
                    <View style={styles.seasonBadge}>
                        <MaterialIcons name="event" size={16} color="#5E35B1" />
                        <Text style={styles.seasonText}>TEMPORADA {selectedYear}</Text>
                    </View>
                </View>

                <ExportCard
                    icon="people"
                    title="Lista de Costaleros"
                    description="Listado completo con teléfono, email, altura y trabajadera."
                    btnText="Exportar CSV"
                    onPress={exportCostaleros}
                />

                <ExportCard
                    icon="grid-on"
                    title="Matriz de Asistencia"
                    description="Cuadrante completo con todos los eventos y la asistencia de cada costalero."
                    btnText="Generar Matriz"
                    color="#2E7D32"
                    onPress={exportAttendanceMatrix}
                />

                <ExportCard
                    icon="assignment"
                    title="Resumen de Eventos"
                    description="Estadísticas de asistencia, totales y porcentajes por cada evento."
                    btnText="Exportar Resumen"
                    color="#F57C00"
                    onPress={exportAllEvents}
                />

                <ExportCard
                    icon="table-chart"
                    title="Libro de Actas (Excel)"
                    description="Reporte avanzado: Elige un evento específico o genera el informe colectivo de toda la temporada."
                    btnText="Exportar Excel"
                    color="#2E7D32"
                    onPress={() => setShowEventSelector(true)}
                />

                <ExportCard
                    icon="menu-book"
                    title="Libro de Actas Detallado (PDF)"
                    description="Listado completo de cada evento en páginas individuales con puestos y estados."
                    btnText="Descargar Informe"
                    color="#5E35B1"
                    onPress={exportDetailedAttendanceReport}
                />

                <ExportCard
                    icon="assessment"
                    title="Informe Avanzado (PDF)"
                    description="Reporte profesional con gráficos, promedios y resumen detallado de la temporada."
                    btnText="Descargar PDF"
                    color="#673AB7"
                    onPress={exportAdvancedSeasonReport}
                />

                <ExportCard
                    icon="qr-code-2"
                    title="Fichas QR para Imprimir"
                    description="Genera un PDF con los códigos QR de todos los costaleros listos para recortar."
                    btnText="Descargar PDF"
                    color="#D32F2F"
                    onPress={printQRReport}
                />

                <View style={styles.footerInfo}>
                    <MaterialIcons name="info-outline" size={20} color="#757575" />
                    <Text style={styles.footerText}>
                        Los archivos CSV se pueden abrir directamente en Google Sheets o Excel para su edición profesional.
                    </Text>
                </View>
            </ScrollView>

            {showEventSelector && (
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Seleccionar Evento</Text>
                            <TouchableOpacity onPress={() => setShowEventSelector(false)}>
                                <MaterialIcons name="close" size={24} color="#757575" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.eventList}>
                            <TouchableOpacity
                                style={[styles.eventItem, { borderLeftColor: '#2E7D32', borderLeftWidth: 4 }]}
                                onPress={() => handleExcelExport(null)}
                            >
                                <View>
                                    <Text style={[styles.eventName, { color: '#2E7D32' }]}>INFORME COLECTIVO</Text>
                                    <Text style={styles.eventDate}>Toda la temporada {selectedYear}</Text>
                                </View>
                                <MaterialIcons name="file-download" size={24} color="#2E7D32" />
                            </TouchableOpacity>

                            {events.map(event => (
                                <TouchableOpacity
                                    key={event.id}
                                    style={styles.eventItem}
                                    onPress={() => handleExcelExport(event.id)}
                                >
                                    <View>
                                        <Text style={styles.eventName}>{event.nombre}</Text>
                                        <Text style={styles.eventDate}>{new Date(event.fecha).toLocaleDateString()}</Text>
                                    </View>
                                    <MaterialIcons name="chevron-right" size={24} color="#BDBDBD" />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            )}

            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#5E35B1" />
                    <Text style={styles.loadingText}>Preparando archivo...</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FF'
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40
    },
    header: {
        marginBottom: 24
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: '#212121',
        marginBottom: 8
    },
    seasonBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EDE7F6',
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#D1C4E9'
    },
    seasonText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#5E35B1',
        marginLeft: 6,
        letterSpacing: 0.5
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 24,
        marginBottom: 20,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#212121',
        marginBottom: 8,
        textAlign: 'center'
    },
    cardDescription: {
        fontSize: 14,
        color: '#757575',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20
    },
    exportButton: {
        flexDirection: 'row',
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        width: '100%',
        justifyContent: 'center'
    },
    exportButtonText: {
        color: 'white',
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: 0.5
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        borderRadius: 20
    },
    loadingText: {
        marginTop: 12,
        color: '#5E35B1',
        fontWeight: '700'
    },
    footerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#EEEEEE',
        marginTop: 10
    },
    footerText: {
        flex: 1,
        fontSize: 12,
        color: '#757575',
        marginLeft: 12,
        lineHeight: 18
    },
    modalOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
        zIndex: 2000
    },
    modalContent: {
        backgroundColor: 'white',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 20,
        paddingHorizontal: 20,
        maxHeight: '80%'
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingHorizontal: 4
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#212121'
    },
    eventList: {
        marginBottom: 30
    },
    eventItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
        backgroundColor: '#FCFCFC',
        marginBottom: 8,
        borderRadius: 12
    },
    eventName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#424242',
        marginBottom: 2
    },
    eventDate: {
        fontSize: 13,
        color: '#757575',
        fontWeight: '500'
    }
});
