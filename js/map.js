// Map module - contains all map-related functions and variables

// Variables globales para el mapa
let map;
let markers = [];
let directionsService;
let directionsRenderer;

// Inicializar Google Maps
function initMap() {
    // Cargar el script de Google Maps API
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${CONFIG.API_KEY}&callback=initMapCallback&libraries=places`;
    script.async = true;
    script.defer = true;
    
    // Manejar errores de carga de script
    script.onerror = function() {
        showStatus('Error al cargar Google Maps API. Verifica tu conexión a internet y la API key.', 'error');
    };
    
    document.head.appendChild(script);
    
    // Función de callback cuando se carga Google Maps
    window.initMapCallback = function() {
        const defaultLocation = { lat: 47.3811, lng: -122.2526 }; // Kent, WA aproximado
        
        map = new google.maps.Map(document.getElementById('map'), {
            zoom: 9,
            center: defaultLocation
        });
        
        directionsService = new google.maps.DirectionsService();
        directionsRenderer = new google.maps.DirectionsRenderer({
            map: map,
            suppressMarkers: true
        });
        
        // Habilitar la búsqueda por autocompletado para el punto de partida
        const autocomplete = new google.maps.places.Autocomplete(
            document.getElementById('startPoint')
        );
        autocomplete.addListener('place_changed', function() {
            const place = autocomplete.getPlace();
            if (!place.geometry) return;
            
            map.setCenter(place.geometry.location);
            map.setZoom(12);
        });
    };
}

// Función para obtener coordenadas a partir de una dirección
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
                service.getDistanceMatrix(
                    {
                        origins: [origin],
                        destinations: destinations,
                        travelMode: 'DRIVING',
                        avoidTolls: true, // Evitar peajes
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
function displayRouteOnMap(startCoords, locations) {
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
    displayRouteOnMap
};