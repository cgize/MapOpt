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
        
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${location.Address1 || ''}</td>
            <td>${location.City || ''}</td>
            <td>${location.State || ''}</td>
            <td>${location.Zip || ''}</td>
            <td>${location.distanceText || location.distance.toFixed(2) + ' km'}</td>
            <td class="row-actions">
                <button class="remove-btn" title="Ignorar esta parada">
                    ❌
                </button>
            </td>
        `;
        
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
}

// Exportar funciones y variables para usar en otros módulos
window.UIModule = {
    initUI,
    showStatus,
    displayResults
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