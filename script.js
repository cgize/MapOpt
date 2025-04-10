document.addEventListener('DOMContentLoaded', function() {
    const startPointInput = document.getElementById('startPoint');
    const csvFileInput = document.getElementById('csvFile');
    const processButton = document.getElementById('processButton');
    const downloadButton = document.getElementById('downloadButton');
    const statusDiv = document.getElementById('status');
    const resultsBody = document.getElementById('resultsBody');
    const loadingDiv = document.getElementById('loading');
    
    // Variable global para almacenar los resultados procesados
    let processedLocations = [];
    
    // Variables para controlar las paradas ignoradas
    let ignoredStops = [];
    let hasIgnoredStops = false;
    
    // Usar la API Key desde el archivo de configuración
    const apiKey = CONFIG.API_KEY;
    
    // Variables globales para el mapa
    let map;
    let markers = [];
    let directionsService;
    let directionsRenderer;
    
    // Inicializar Google Maps
    function initMap() {
        // Cargar el script de Google Maps API
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMapCallback&libraries=places`;
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
            const autocomplete = new google.maps.places.Autocomplete(startPointInput);
            autocomplete.addListener('place_changed', function() {
                const place = autocomplete.getPlace();
                if (!place.geometry) return;
                
                map.setCenter(place.geometry.location);
                map.setZoom(12);
            });
        };
    }
    
    // Inicializar el mapa
    initMap();
    
    processButton.addEventListener('click', async function() {
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
            const csvData = await readCSV(file);
            
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
                startCoords = await getCoordinates(startPoint);
            } catch (error) {
                showStatus('Error al obtener las coordenadas del punto de partida: ' + error.message, 'error');
                loadingDiv.style.display = 'none';
                return;
            }
            
            // Calcular distancias usando Google Distance Matrix
            const locationsWithCoords = await getLocationsCoordinates(csvData);
            const locationsWithDistances = await calculateDistances(locationsWithCoords, startCoords);
            
            // Optimizar la ruta usando el algoritmo del vecino más cercano
            const optimizedRoute = optimizeRouteNearestNeighbor(locationsWithDistances, startCoords);
            
            // Guardar los resultados para poder descargarlos después
            processedLocations = optimizedRoute;
            ignoredStops = [];
            hasIgnoredStops = false;
            
            // Reiniciar estado de recalculación
            document.querySelector('.recalculate-container').style.display = 'none';
            
            // Mostrar resultados
            displayResults(optimizedRoute);
            
            // Mostrar la ruta en el mapa
            displayRouteOnMap(startCoords, optimizedRoute);
            
            // Habilitar el botón de descarga
            downloadButton.disabled = false;
            
            showStatus('Procesamiento completado con éxito', 'success');
        } catch (error) {
            console.error(error);
            showStatus('Error al procesar el archivo: ' + error.message, 'error');
        } finally {
            loadingDiv.style.display = 'none';
        }
    });
    
    // Función para recalcular la ruta sin las paradas ignoradas
    document.getElementById('recalculateButton').addEventListener('click', function() {
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
        const optimizedRoute = optimizeRouteNearestNeighbor(filteredLocations, startCoords);
        
        // Actualizar los resultados
        processedLocations = optimizedRoute;
        ignoredStops = [];
        hasIgnoredStops = false;
        
        // Ocultar el botón de recalcular
        document.querySelector('.recalculate-container').style.display = 'none';
        
        // Mostrar resultados
        displayResults(optimizedRoute);
        
        // Mostrar la ruta en el mapa
        displayRouteOnMap(startCoords, optimizedRoute);
        
        showStatus('Ruta recalculada con éxito', 'success');
    });
    
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
    
    // Función para descargar los resultados como CSV
    downloadButton.addEventListener('click', function() {
        if (!processedLocations || processedLocations.length === 0) {
            showStatus('No hay datos para descargar. Procesa primero los datos.', 'error');
            return;
        }
        
        // Crear el contenido del CSV
        const headers = ['Orden', 'Dirección', 'Ciudad', 'Estado', 'Código Postal', 'Distancia (km)'];
        let csvContent = headers.join(',') + '\n';
        
        processedLocations.forEach((location, index) => {
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
    });
    
    function showStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = 'status ' + type;
        console.log(message); // Agregar registro en consola para depuración
    }
    
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
    
    function displayRouteOnMap(startCoords, locations) {
        // Limpiar marcadores anteriores
        markers.forEach(marker => marker.setMap(null));
        markers = [];
        
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
        
        // Crear la ruta si hay al menos una ubicación
        if (locations.length > 0) {
            // Limitar a 8 waypoints para evitar exceder el límite de la API de Google
            // La API de Directions tiene un límite de 10 waypoints en total, pero dejamos margen
            const MAX_WAYPOINTS = 8;
            showStatus(`Mostrando ruta para los primeros ${MAX_WAYPOINTS} destinos (limitación de la API de Google Maps)`, 'success');
            const waypoints = locations.slice(0, MAX_WAYPOINTS).map(location => {
                return {
                    location: new google.maps.LatLng(location.coords.lat, location.coords.lng),
                    stopover: true
                };
            });
            
            const request = {
                origin: new google.maps.LatLng(startCoords.lat, startCoords.lng),
                destination: new google.maps.LatLng(startCoords.lat, startCoords.lng), // Volver al punto de partida
                waypoints: waypoints,
                optimizeWaypoints: true,
                travelMode: 'DRIVING',
                avoidTolls: true  // Evitar peajes
            };
            
            directionsService.route(request, function(result, status) {
                if (status === 'OK') {
                    directionsRenderer.setDirections(result);
                } else {
                    console.error('Error al calcular la ruta: ' + status);
                    showStatus('No se pudo calcular la ruta completa. Mostrando solo los marcadores.', 'error');
                }
            });
        }
    }
});