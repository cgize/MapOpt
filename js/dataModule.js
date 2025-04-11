// dataModule.js - Módulo principal para mantener compatibilidad con el código existente
// Reemplaza al antiguo data.js, proporcionando una interfaz unificada para los demás módulos

// Exportar funciones y variables para usar en otros módulos
window.DataModule = {
    // Funciones de DataHandler
    readCSV: window.DataHandler.readCSV,
    extractAddressParts: window.DataHandler.extractAddressParts,
    determineLocationType: window.DataHandler.determineLocationType,
    downloadCSV: window.DataHandler.downloadCSV,
    
    // Funciones de RouteOptimizer
    optimizeRoute: window.RouteOptimizer.optimizeRoute,
    optimizeRouteNearestNeighbor: window.RouteOptimizer.optimizeRouteNearestNeighbor,
    findNearestPointIndex: window.RouteOptimizer.findNearestPointIndex,
    calculateHaversineDistance: window.RouteOptimizer.calculateHaversineDistance
};