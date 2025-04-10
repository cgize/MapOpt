// Data module - contains functions for data processing, CSV handling, and route optimization

// Función para leer archivos CSV
function readCSV(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(event) {
            const csvText = event.target.result;
            const lines = csvText.split('\n');
            const headers = lines[0].split(',');
            
            const data = [];
            
            for (let i = 1; i < lines.length; i++) {
                if (lines[i].trim() === '') continue;
                
                const values = lines[i].split(',');
                const entry = {};
                
                for (let j = 0; j < headers.length; j++) {
                    entry[headers[j].trim()] = values[j] ? values[j].trim() : '';
                }
                
                data.push(entry);
            }
            
            resolve(data);
        };
        
        reader.onerror = function() {
            reject(new Error('Error al leer el archivo'));
        };
        
        reader.readAsText(file);
    });
}

// Función para optimizar la ruta usando el algoritmo del vecino más cercano
function optimizeRouteNearestNeighbor(locations, startCoords) {
    if (locations.length === 0) return [];
    
    // Crear una copia de las ubicaciones para no modificar el original
    const unvisited = [...locations];
    const optimizedRoute = [];
    
    // Punto actual - comenzamos desde el punto de partida
    let currentPoint = {
        coords: { lat: startCoords.lat, lng: startCoords.lng },
        isStartPoint: true
    };
    
    // Variable para llevar un seguimiento del progreso
    const totalPoints = unvisited.length;
    let pointsProcessed = 0;
    
    // Mientras haya puntos sin visitar
    while (unvisited.length > 0) {
        // Encontrar el punto más cercano al punto actual
        let nearestIndex = findNearestPointIndex(currentPoint, unvisited);
        
        // Añadir el punto más cercano a la ruta optimizada
        const nearestPoint = unvisited.splice(nearestIndex, 1)[0];
        optimizedRoute.push(nearestPoint);
        
        // Actualizar el punto actual al último punto añadido
        currentPoint = nearestPoint;
        
        // Actualizar progreso
        pointsProcessed++;
        if (pointsProcessed % 5 === 0 || pointsProcessed === totalPoints) {
            showStatus(`Optimizando ruta: ${pointsProcessed}/${totalPoints} puntos procesados`, 'success');
        }
    }
    
    return optimizedRoute;
}

// Función para encontrar el índice del punto más cercano
function findNearestPointIndex(currentPoint, points) {
    if (points.length === 0) return -1;
    if (points.length === 1) return 0;
    
    let minDistance = Number.MAX_VALUE;
    let nearestIndex = -1;
    
    for (let i = 0; i < points.length; i++) {
        const distance = calculateHaversineDistance(
            currentPoint.coords.lat, currentPoint.coords.lng,
            points[i].coords.lat, points[i].coords.lng
        );
        
        if (distance < minDistance) {
            minDistance = distance;
            nearestIndex = i;
        }
    }
    
    return nearestIndex;
}

// Función para calcular la distancia Haversine entre dos puntos
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radio de la Tierra en km
    
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
        
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // Distancia en km
    
    return distance;
}

// Función para generar y descargar el archivo CSV con los resultados
function downloadCSV(locations) {
    if (!locations || locations.length === 0) {
        showStatus('No hay datos para descargar. Procesa primero los datos.', 'error');
        return;
    }
    
    // Crear el contenido del CSV
    const headers = ['Orden', 'Dirección', 'Ciudad', 'Estado', 'Código Postal', 'Distancia (km)'];
    let csvContent = headers.join(',') + '\n';
    
    locations.forEach((location, index) => {
        // Escapar comillas en los campos de texto para CSV
        const address = location.Address1 ? `"${location.Address1.replace(/"/g, '""')}"` : '';
        const city = location.City ? `"${location.City.replace(/"/g, '""')}"` : '';
        const state = location.State ? `"${location.State.replace(/"/g, '""')}"` : '';
        const zip = location.Zip ? `"${location.Zip.replace(/"/g, '""')}"` : '';
        // Formatear la distancia
        const distance = location.distanceText || location.distance.toFixed(2) + ' km';
        
        // Crear la fila CSV
        const row = [
            index + 1,
            address,
            city,
            state,
            zip,
            `"${distance.replace(/"/g, '""')}"`
        ];
        
        csvContent += row.join(',') + '\n';
    });
    
    // Crear un objeto Blob con el contenido CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Crear un enlace para descargar el archivo
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    
    // Generar un nombre de archivo con la fecha y hora actual
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-');
    link.download = `ruta_optimizada_${dateStr}_${timeStr}.csv`;
    
    // Simular un clic para iniciar la descarga
    document.body.appendChild(link);
    link.click();
    
    // Limpiar
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    
    showStatus('Archivo CSV descargado correctamente', 'success');
}

// Exportar funciones y variables para usar en otros módulos
window.DataModule = {
    readCSV,
    optimizeRouteNearestNeighbor,
    findNearestPointIndex,
    calculateHaversineDistance,
    downloadCSV
};