// Map module - contains all map-related functions and variables

// Variables globales para el mapa
let map;
let markers = [];
let directionsService;
let directionsRenderer;
let markerLibrary; // Para almacenar la biblioteca de marcadores

// Inicializar Google Maps
function initMap() {
    // Obtener la API key desde la configuración
    let apiKey = '';
    
    if (window.ConfigModule && typeof window.ConfigModule.getConfig === 'function') {
        const config = window.ConfigModule.getConfig();
        apiKey = config.apiKey || '';
    }
    
    // Fallback a la API key antigua si no hay una nueva
    if (!apiKey && window.CONFIG && window.CONFIG.API_KEY) {
        apiKey = window.CONFIG.API_KEY;
    }
    
    // Definir la función de callback que se ejecutará cuando se cargue Google Maps
    window.initMapCallback = async function() {
        const defaultLocation = { lat: 47.3811, lng: -122.2526 }; // Kent, WA aproximado
        
        // Cargar la biblioteca de marcadores avanzados
        try {
            markerLibrary = await google.maps.importLibrary("marker");
        } catch (error) {
            console.warn('Error al cargar la biblioteca de marcadores:', error);
        }
        
        map = new google.maps.Map(document.getElementById('map'), {
            zoom: 9,
            center: defaultLocation,
            mapId: 'DEMO_MAP_ID' // Requerido para marcadores avanzados
        });
        
        directionsService = new google.maps.DirectionsService();
        directionsRenderer = new google.maps.DirectionsRenderer({
            map: map,
            suppressMarkers: true
        });
        
        // Habilitar la búsqueda por autocompletado para el punto de partida
        // Usar simplemente el Autocomplete tradicional para mayor compatibilidad
        const startPointInput = document.getElementById('startPoint');
        if (startPointInput) {
            // Asegurarse de que el campo tenga un valor predeterminado
            if (!startPointInput.value) {
                startPointInput.value = '19308 70th Ave S, Kent, WA 98032';
            }
            
            // Usar el Autocomplete tradicional
            const autocomplete = new google.maps.places.Autocomplete(startPointInput);
            autocomplete.addListener('place_changed', function() {
                const place = autocomplete.getPlace();
                if (!place.geometry) return;
                
                map.setCenter(place.geometry.location);
                map.setZoom(12);
            });
        } else {
            console.warn('No se encontró el campo de punto de partida en el DOM');
        }
    };

    // Cargar Google Maps API de manera asíncrona siguiendo las mejores prácticas
    // https://goo.gle/js-api-loading
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMapCallback&libraries=places,marker&loading=async`;
    script.async = true; // Esto asegura que el script se cargue de manera asíncrona
    
    // Manejar errores de carga
    script.onerror = function() {
        showStatus('Error al cargar Google Maps API. Verifica tu conexión a internet y la API key.', 'error');
    };
    
    document.head.appendChild(script);
}

// Función para actualizar la configuración del mapa
function updateMapConfig(config) {
    // Guardar las preferencias de ruta para usarlas en futuros cálculos
    window.mapPreferences = {
        avoidTolls: config.routePreferences?.avoidTolls || false,
        avoidHighways: config.routePreferences?.avoidHighways || false,
        transportMode: config.routePreferences?.transportMode || 'driving'
    };
    
    // Mostrar mensaje de confirmación
    showStatus('Configuración del mapa actualizada', 'success');
    return true;
}

// Función para obtener las coordenadas a partir de una dirección
async function getCoordinates(address) {
    return new Promise((resolve, reject) => {
        const geocoder = new google.maps.Geocoder();
        
        geocoder.geocode({ address: address }, function(results, status) {
            if (status === 'OK') {
                const location = results[0].geometry.location;
                resolve({
                    lat: location.lat(),
                    lng: location.lng(),
                    formattedAddress: results[0].formatted_address
                });
            } else {
                reject(new Error('Error de geocodificación: ' + status));
            }
        });
    });
}

// Función para obtener las coordenadas de múltiples ubicaciones
async function getLocationsCoordinates(locations) {
    const geocoder = new google.maps.Geocoder();
    const MAX_LOCATIONS = 100; // Limitar el número máximo de ubicaciones para procesar
    
    // Si hay demasiadas ubicaciones, limitar el número para evitar problemas de rendimiento
    if (locations.length > MAX_LOCATIONS) {
        showStatus(`Limitando a ${MAX_LOCATIONS} ubicaciones de las ${locations.length} totales para evitar problemas de rendimiento`, 'error');
        locations = locations.slice(0, MAX_LOCATIONS);
    }
    
    // Limitar a 10 direcciones a la vez para evitar problemas con las cuotas de la API
    const batchSize = 10;
    const batches = [];
    
    for (let i = 0; i < locations.length; i += batchSize) {
        batches.push(locations.slice(i, i + batchSize));
    }
    
    let locationsWithCoords = [];
    
    for (const batch of batches) {
        showStatus(`Geocodificando direcciones (${locationsWithCoords.length}/${locations.length})...`, 'success');
        
        const batchPromises = batch.map(location => {
            const fullAddress = `${location.Address1}, ${location.City}, ${location.State} ${location.Zip}`;
            
            return new Promise((resolve) => {
                geocoder.geocode({ address: fullAddress }, function(results, status) {
                    if (status === 'OK') {
                        const coords = {
                            lat: results[0].geometry.location.lat(),
                            lng: results[0].geometry.location.lng(),
                            formattedAddress: results[0].formatted_address
                        };
                        
                        resolve({
                            ...location,
                            fullAddress,
                            coords
                        });
                    } else {
                        // Si falla la geocodificación, conservar la ubicación sin coordenadas
                        console.warn(`Error de geocodificación para ${fullAddress}: ${status}`);
                        resolve({
                            ...location,
                            fullAddress,
                            coords: null
                        });
                    }
                });
            });
        });
        
        const batchResults = await Promise.all(batchPromises);
        locationsWithCoords = [...locationsWithCoords, ...batchResults];
        
        // Pequeña pausa para respetar los límites de la API
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Filtrar las ubicaciones que no se pudieron geocodificar
    const validLocations = locationsWithCoords.filter(location => location.coords !== null);
    
    if (validLocations.length === 0) {
        throw new Error('No se pudo geocodificar ninguna de las direcciones proporcionadas. Por favor, verifica el formato del archivo CSV.');
    }
    
    return validLocations;
}

// Función para calcular distancias entre ubicaciones
async function calculateDistances(locations, startCoords) {
    try {
        const service = new google.maps.DistanceMatrixService();
        const origin = new google.maps.LatLng(startCoords.lat, startCoords.lng);
        
        // Dividir las ubicaciones en lotes para respetar los límites de la API
        // La API tiene un límite de 25 destinos por solicitud
        const BATCH_SIZE = 20; // Usamos 20 para estar seguros
        const batches = [];
        
        for (let i = 0; i < locations.length; i += BATCH_SIZE) {
            batches.push(locations.slice(i, Math.min(i + BATCH_SIZE, locations.length)));
        }
        
        let allLocationsWithDistances = [];
        
        // Procesar cada lote secuencialmente
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batchLocations = batches[batchIndex];
            
            showStatus(`Calculando distancias (lote ${batchIndex + 1} de ${batches.length})...`, 'success');
            
            // Preparar las ubicaciones de destino para este lote
            const destinations = batchLocations.map(location => 
                new google.maps.LatLng(location.coords.lat, location.coords.lng)
            );
            
            // Esperar un momento entre solicitudes para evitar límites de tasa
            if (batchIndex > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            // Realizar la solicitud para este lote
            const batchDistances = await new Promise((resolve, reject) => {
                // Obtener preferencias de ruta de la configuración
                const preferences = window.mapPreferences || {
                    avoidTolls: false,
                    avoidHighways: false,
                    transportMode: 'DRIVING'
                };
                
                // Convertir string a enum de Google Maps para modo de transporte
                let travelMode = google.maps.TravelMode.DRIVING;
                if (preferences.transportMode === 'bicycling') {
                    travelMode = google.maps.TravelMode.BICYCLING;
                } else if (preferences.transportMode === 'walking') {
                    travelMode = google.maps.TravelMode.WALKING;
                }
                
                service.getDistanceMatrix(
                    {
                        origins: [origin],
                        destinations: destinations,
                        travelMode: travelMode,
                        avoidTolls: preferences.avoidTolls,
                        avoidHighways: preferences.avoidHighways,
                        unitSystem: google.maps.UnitSystem.METRIC
                    },
                    function(response, status) {
                        if (status === 'OK') {
                            const distances = response.rows[0].elements;
                            
                            const locationsWithDistances = batchLocations.map((location, index) => {
                                const distanceData = distances[index];
                                
                                if (distanceData.status === 'OK') {
                                    return {
                                        ...location,
                                        distance: distanceData.distance.value / 1000, // Convertir a km
                                        distanceText: distanceData.distance.text,
                                        duration: distanceData.duration.value,
                                        durationText: distanceData.duration.text
                                    };
                                } else {
                                    // Si no se pudo calcular la distancia, usar una distancia muy grande
                                    return {
                                        ...location,
                                        distance: 99999,
                                        distanceText: 'N/A',
                                        duration: 99999,
                                        durationText: 'N/A'
                                    };
                                }
                            });
                            
                            resolve(locationsWithDistances);
                        } else {
                            reject(new Error('Error al calcular distancias: ' + status));
                        }
                    }
                );
            });
            
            // Agregar los resultados de este lote a los resultados totales
            allLocationsWithDistances = [...allLocationsWithDistances, ...batchDistances];
        }
        
        return allLocationsWithDistances;
    } catch (error) {
        throw new Error('Error al calcular distancias: ' + error.message);
    }
}

// Función para mostrar la ruta en el mapa
async function displayRouteOnMap(startCoords, locations) {
    // Asegurarse de que la biblioteca de marcadores esté cargada
    if (!markerLibrary) {
        try {
            markerLibrary = await google.maps.importLibrary("marker");
        } catch (error) {
            console.warn('Error al cargar la biblioteca de marcadores:', error);
            // En caso de error, usamos el método tradicional
            displayRouteOnMapLegacy(startCoords, locations);
            return;
        }
    }
    
    // Limpiar marcadores anteriores
    markers.forEach(marker => marker.setMap(null));
    markers = [];
    
    // Limpiar cualquier ruta previa
    directionsRenderer.setDirections({routes: []});
    
    // Centrar el mapa en el punto de partida
    map.setCenter(startCoords);
    map.setZoom(9);
    
    // Crear un PinElement para el punto de partida
    const startPin = new markerLibrary.PinElement({
        background: '#009933',
        borderColor: '#006622',
        glyphColor: '#FFFFFF',
        scale: 1.2
    });
    
    // Añadir marcador para el punto de partida
    const startMarker = new markerLibrary.AdvancedMarkerElement({
        map,
        position: startCoords,
        content: startPin.element,
        title: 'Punto de partida',
        zIndex: 1000
    });
    
    markers.push(startMarker);
    
    // Añadir marcadores para cada ubicación
    locations.forEach((location, index) => {
        // Crear un Pin con etiqueta numérica
        const pin = new markerLibrary.PinElement({
            background: '#DB4437',
            glyphColor: '#FFFFFF',
            scale: 1.0
        });
        
        // Establecer el número como glyph
        const glyph = document.createElement('div');
        glyph.textContent = (index + 1).toString();
        glyph.style.fontWeight = 'bold';
        pin.glyph = glyph;
        
        // Crear el marcador avanzado
        const marker = new markerLibrary.AdvancedMarkerElement({
            map,
            position: { lat: location.coords.lat, lng: location.coords.lng },
            content: pin.element,
            title: `${index + 1}. ${location.fullAddress}`
        });
        
        markers.push(marker);
    });
    
    // Ajustar el zoom para que se vean todos los marcadores si hay al menos una ubicación
    if (locations.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        markers.forEach(marker => bounds.extend(marker.position));
        map.fitBounds(bounds);
    }
}

// Función legacy como fallback si no podemos cargar los marcadores avanzados
function displayRouteOnMapLegacy(startCoords, locations) {
    // Limpiar marcadores anteriores
    markers.forEach(marker => marker.setMap(null));
    markers = [];
    
    // Limpiar cualquier ruta previa
    directionsRenderer.setDirections({routes: []});
    
    // Centrar el mapa en el punto de partida
    map.setCenter(startCoords);
    map.setZoom(9);
    
    // Añadir marcador para el punto de partida
    const startMarker = new google.maps.Marker({
        position: startCoords,
        map: map,
        title: 'Punto de partida',
        icon: {
            url: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png'
        },
        zIndex: 1000
    });
    
    markers.push(startMarker);
    
    // Añadir marcadores para cada ubicación
    locations.forEach((location, index) => {
        const marker = new google.maps.Marker({
            position: { lat: location.coords.lat, lng: location.coords.lng },
            map: map,
            title: `${index + 1}. ${location.fullAddress}`,
            label: {
                text: (index + 1).toString(),
                color: 'white'
            }
        });
        
        markers.push(marker);
    });
    
    // Ajustar el zoom para que se vean todos los marcadores si hay al menos una ubicación
    if (locations.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        markers.forEach(marker => bounds.extend(marker.getPosition()));
        map.fitBounds(bounds);
    }
}

// Exportar funciones y variables para usar en otros módulos
window.MapModule = {
    initMap,
    getCoordinates,
    getLocationsCoordinates,
    calculateDistances,
    displayRouteOnMap,
    updateMapConfig,
    displayRouteOnMapLegacy
};