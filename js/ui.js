// UI module - handles UI interactions, event listeners, and display functions

// Variables para elementos del DOM
let startPointInput;
let csvFileInput;
let processButton;
let downloadButton;
let statusDiv;
let resultsBody;
let loadingDiv;
let recalculateButton;

// Variables para controlar las paradas ignoradas
let ignoredStops = [];
let hasIgnoredStops = false;

// Variable global para almacenar los resultados procesados
let processedLocations = [];

// Variables para navegación secuencial
let completedStops = [];
let currentStopIndex = 0;
let sequentialNavContainer;

// Inicializar la interfaz de usuario
function initUI() {
    // Obtener referencias a elementos del DOM
    startPointInput = document.getElementById('startPoint');
    csvFileInput = document.getElementById('csvFile');
    processButton = document.getElementById('processButton');
    downloadButton = document.getElementById('downloadButton');
    statusDiv = document.getElementById('status');
    resultsBody = document.getElementById('resultsBody');
    loadingDiv = document.getElementById('loading');
    recalculateButton = document.getElementById('recalculateButton');
    
    // Configurar event listeners
    processButton.addEventListener('click', processData);
    downloadButton.addEventListener('click', () => {
        DataModule.downloadCSV(processedLocations);
    });
    recalculateButton.addEventListener('click', recalculateRoute);
}

// Función para mostrar mensajes de estado
function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + type;
    console.log(message); // Agregar registro en consola para depuración
}

// Función principal para procesar los datos
async function processData() {
    const file = csvFileInput.files[0];
    const startPoint = startPointInput.value.trim();
    
    if (!file) {
        showStatus('Por favor, selecciona un archivo CSV', 'error');
        return;
    }
    
    if (!startPoint) {
        showStatus('Por favor, ingresa un punto de partida', 'error');
        return;
    }
    
    showStatus('Procesando...', 'success');
    loadingDiv.style.display = 'block';
    
    try {
        // Leer el archivo CSV
        const csvData = await DataModule.readCSV(file);
        
        // Verificar que el CSV tiene datos válidos
        if (!csvData || csvData.length === 0) {
            throw new Error('El archivo CSV está vacío o no tiene el formato correcto.');
        }
        
        // Verificar que el CSV tiene las columnas necesarias
        const requiredColumns = ['Address1', 'City', 'State', 'Zip'];
        const missingColumns = requiredColumns.filter(col => !Object.keys(csvData[0]).includes(col));
        
        if (missingColumns.length > 0) {
            throw new Error(`El archivo CSV no contiene las columnas requeridas: ${missingColumns.join(', ')}`);
        }
        
        // Asegurarse de que Google Maps API esté cargado
        if (typeof google === 'undefined') {
            throw new Error('Google Maps no se ha cargado correctamente. Por favor, recarga la página.');
        }
        
        // Obtener las coordenadas del punto de partida
        let startCoords;
        try {
            startCoords = await MapModule.getCoordinates(startPoint);
        } catch (error) {
            showStatus('Error al obtener las coordenadas del punto de partida: ' + error.message, 'error');
            loadingDiv.style.display = 'none';
            return;
        }
        
        // Calcular distancias usando Google Distance Matrix
        const locationsWithCoords = await MapModule.getLocationsCoordinates(csvData);
        const locationsWithDistances = await MapModule.calculateDistances(locationsWithCoords, startCoords);
        
        // Optimizar la ruta usando el algoritmo del vecino más cercano
        const optimizedRoute = DataModule.optimizeRouteNearestNeighbor(locationsWithDistances, startCoords);
        
        // Guardar los resultados para poder descargarlos después
        processedLocations = optimizedRoute;
        ignoredStops = [];
        hasIgnoredStops = false;
        
        // Reiniciar variables de navegación secuencial
        completedStops = [];
        currentStopIndex = 0;
        
        // Reiniciar estado de recalculación
        document.querySelector('.recalculate-container').style.display = 'none';
        
        // Mostrar resultados
        displayResults(optimizedRoute);
        
        // Mostrar la ruta en el mapa
        MapModule.displayRouteOnMap(startCoords, optimizedRoute);
        
        // Habilitar el botón de descarga
        downloadButton.disabled = false;
        
        showStatus('Procesamiento completado con éxito', 'success');
    } catch (error) {
        console.error(error);
        showStatus('Error al procesar el archivo: ' + error.message, 'error');
    } finally {
        loadingDiv.style.display = 'none';
    }
}

// Función para recalcular la ruta sin las paradas ignoradas
function recalculateRoute() {
    if (!hasIgnoredStops) return;
    
    showStatus('Recalculando ruta sin paradas ignoradas...', 'success');
    
    // Filtrar las ubicaciones ignoradas
    const filteredLocations = processedLocations.filter((location, index) => 
        !ignoredStops.includes(index)
    );
    
    // Verificar si quedan ubicaciones después de filtrar
    if (filteredLocations.length === 0) {
        showStatus('No hay paradas disponibles para recalcular la ruta. Por favor, reactive alguna parada.', 'error');
        return;
    }
    
    // Obtener coordenadas del punto de partida original
    const startCoords = {
        lat: filteredLocations[0].coords.lat, 
        lng: filteredLocations[0].coords.lng
    };
    
    // Optimizar la ruta nuevamente
    const optimizedRoute = DataModule.optimizeRouteNearestNeighbor(filteredLocations, startCoords);
    
    // Actualizar los resultados
    processedLocations = optimizedRoute;
    ignoredStops = [];
    hasIgnoredStops = false;
    
    // Reiniciar variables de navegación secuencial
    completedStops = [];
    currentStopIndex = 0;
    
    // Ocultar el botón de recalcular
    document.querySelector('.recalculate-container').style.display = 'none';
    
    // Mostrar resultados
    displayResults(optimizedRoute);
    
    // Mostrar la ruta en el mapa
    MapModule.displayRouteOnMap(startCoords, optimizedRoute);
    
    showStatus('Ruta recalculada con éxito', 'success');
}

// Función para mostrar resultados en la tabla
function displayResults(locations) {
    resultsBody.innerHTML = '';
    
    locations.forEach((location, index) => {
        const row = document.createElement('tr');
        row.dataset.index = index;
        
        // Aplicar clase 'completed' si la parada ya está completada
        if (completedStops.includes(index)) {
            row.classList.add('completed');
        }
        
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${location.Address1 || ''}</td>
            <td>${location.City || ''}</td>
            <td>${location.State || ''}</td>
            <td>${location.Zip || ''}</td>
            <td>${location.distanceText || location.distance.toFixed(2) + ' km'}</td>
            <td class="row-actions">
                <button class="navigate-btn" title="Navegar a esta parada">
                    🚗
                </button>
                <button class="complete-btn" title="Marcar como entregado">
                    ✅
                </button>
                <button class="remove-btn" title="Ignorar esta parada">
                    ❌
                </button>
            </td>
        `;
        
        // Añadir evento para navegar a la parada
        row.querySelector('.navigate-btn').addEventListener('click', function(e) {
            e.stopPropagation();
            navigateToStop(location);
        });
        
        // Añadir evento para marcar como entregado
        row.querySelector('.complete-btn').addEventListener('click', function(e) {
            e.stopPropagation();
            markAsCompleted(row, index);
        });
        
        // Añadir evento para ignorar parada
        row.querySelector('.remove-btn').addEventListener('click', function(e) {
            e.stopPropagation();
            
            if (row.classList.contains('ignored')) {
                // Si ya estaba ignorada, la reactivamos
                row.classList.remove('ignored');
                const stopIndex = ignoredStops.indexOf(index);
                if (stopIndex > -1) {
                    ignoredStops.splice(stopIndex, 1);
                }
                
                if (ignoredStops.length === 0) {
                    hasIgnoredStops = false;
                    document.querySelector('.recalculate-container').style.display = 'none';
                }
            } else {
                // Ignorar esta parada
                row.classList.add('ignored');
                ignoredStops.push(index);
                hasIgnoredStops = true;
                document.querySelector('.recalculate-container').style.display = 'block';
            }
        });
        
        resultsBody.appendChild(row);
    });
    
    // Agregar contenedor para navegar secuencialmente
    addSequentialNavigation();
}

// Función para navegar a una parada específica
function navigateToStop(location) {
    // Verificar que tengamos coordenadas válidas
    if (!location || !location.coords) {
        showStatus('No se pueden obtener coordenadas para esta parada', 'error');
        return;
    }
    
    // Crear la URL para Google Maps
    const destination = `${location.coords.lat},${location.coords.lng}`;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
    
    // Abrir Google Maps en una nueva pestaña
    window.open(url, '_blank');
}

// Función para marcar una parada como completada
function markAsCompleted(row, index) {
    // Agregar a la lista de paradas completadas si no está ya
    if (!completedStops.includes(index)) {
        completedStops.push(index);
    }
    
    // Marcar visualmente la fila como completada
    row.classList.add('completed');
    
    // Actualizar la navegación secuencial
    updateSequentialNavigation();
    
    // Mostrar mensaje de éxito
    showStatus(`Parada #${index + 1} marcada como entregada`, 'success');
}

// Función para agregar el contenedor de navegación secuencial
function addSequentialNavigation() {
    // Buscar si ya existe el contenedor y eliminarlo
    const existingContainer = document.getElementById('sequential-navigation');
    if (existingContainer) {
        existingContainer.remove();
    }
    
    // Crear el contenedor de navegación secuencial
    sequentialNavContainer = document.createElement('div');
    sequentialNavContainer.id = 'sequential-navigation';
    sequentialNavContainer.className = 'sequential-navigation';
    
    // Obtener el contenedor principal para insertarlo
    const resultsContainer = document.getElementById('results');
    resultsContainer.appendChild(sequentialNavContainer);
    
    // Reiniciar variables de navegación si no hay paradas completadas
    if (completedStops.length === 0) {
        currentStopIndex = 0;
    }
    
    // Actualizar el contenido
    updateSequentialNavigation();
}

// Función para actualizar la navegación secuencial
function updateSequentialNavigation() {
    if (!sequentialNavContainer || processedLocations.length === 0) return;
    
    // Encontrar el próximo índice no completado
    while (completedStops.includes(currentStopIndex) && currentStopIndex < processedLocations.length) {
        currentStopIndex++;
    }
    
    // Verificar si hemos completado todas las paradas
    if (currentStopIndex >= processedLocations.length) {
        sequentialNavContainer.innerHTML = `
            <div class="sequential-nav-content">
                <h3>¡Ruta Completada!</h3>
                <p>Has completado todas las entregas.</p>
                <button id="reset-route-btn">Reiniciar Ruta</button>
            </div>
        `;
        
        // Agregar evento para reiniciar la ruta
        document.getElementById('reset-route-btn').addEventListener('click', function() {
            // Reiniciar variables
            completedStops = [];
            currentStopIndex = 0;
            
            // Quitar clase 'completed' de todas las filas
            const rows = resultsBody.querySelectorAll('tr');
            rows.forEach(row => row.classList.remove('completed'));
            
            // Actualizar navegación
            updateSequentialNavigation();
        });
        
        return;
    }
    
    // Obtener la parada actual
    const currentStop = processedLocations[currentStopIndex];
    const totalCompleted = completedStops.length;
    const totalStops = processedLocations.length;
    
    // Actualizar el contenido
    sequentialNavContainer.innerHTML = `
        <div class="sequential-nav-content">
            <h3>Navegación Secuencial</h3>
            <p>Progreso: ${totalCompleted}/${totalStops} entregas completadas</p>
            <div class="current-stop-info">
                <p><strong>Siguiente Parada (#${currentStopIndex + 1}):</strong></p>
                <p>${currentStop.Address1}, ${currentStop.City}, ${currentStop.State} ${currentStop.Zip}</p>
            </div>
            <div class="nav-buttons">
                <button id="nav-to-current-btn">Navegar a esta parada 🚗</button>
                <button id="mark-current-completed-btn">Marcar como entregado ✅</button>
            </div>
        </div>
    `;
    
    // Agregar eventos a los botones
    document.getElementById('nav-to-current-btn').addEventListener('click', function() {
        navigateToStop(currentStop);
    });
    
    document.getElementById('mark-current-completed-btn').addEventListener('click', function() {
        // Encontrar la fila correspondiente y marcarla como completada
        const row = resultsBody.querySelector(`tr[data-index="${currentStopIndex}"]`);
        if (row) {
            markAsCompleted(row, currentStopIndex);
        }
    });
}

// Exportar funciones y variables para usar en otros módulos
window.UIModule = {
    initUI,
    showStatus,
    displayResults,
    navigateToStop,
    markAsCompleted,
    updateSequentialNavigation
};

// Exponer la función showStatus globalmente para que otros módulos puedan usarla
window.showStatus = showStatus;

// Inicializar el módulo cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', function() {
    // Inicializar la interfaz de usuario
    initUI();
    
    // Inicializar el mapa
    MapModule.initMap();
});