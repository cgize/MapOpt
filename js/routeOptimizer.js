// routeOptimizer.js - Módulo para algoritmos de optimización de rutas

// Función principal para optimizar la ruta
function optimizeRoute(locations, startCoords) {
    // Siempre usar el algoritmo del vecino más cercano
    return optimizeRouteNearestNeighbor(locations, startCoords);
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

// Exportar funciones y variables para usar en otros módulos
window.RouteOptimizer = {
    optimizeRoute,
    optimizeRouteNearestNeighbor,
    calculateHaversineDistance,
    findNearestPointIndex
};