// dataHandler.js - Módulo para procesamiento de archivos y extracción de datos

// Función para leer archivos CSV y XLSX
function readCSV(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        const fileName = file.name.toLowerCase();
        
        // Determinar si es un archivo Excel (.xlsx, .xls) o CSV
        const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
        
        if (isExcel) {
            // Para archivos Excel
            reader.onload = function(event) {
                try {
                    // Leer el archivo Excel usando SheetJS
                    const data = new Uint8Array(event.target.result);
                    const workbook = XLSX.read(data, {type: 'array'});
                    
                    // Obtener la primera hoja
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    
                    // Convertir a JSON
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, {raw: false});
                    
                    // Procesar los datos para formatearlos correctamente
                    const processedData = [];
                    
                    // Mapear los campos del Excel al formato esperado por la aplicación
                    jsonData.forEach(row => {
                        // Procesar direcciones según la estructura del Excel proporcionado
                        const addressParts = extractAddressParts(row);
                        
                        // Crear entrada con estructura esperada por la aplicación
                        const entry = {
                            Address1: addressParts.address,
                            City: addressParts.city,
                            State: addressParts.state || '',
                            Zip: addressParts.zip || '',
                            DeliverBy: addressParts.deliverBy || '',
                            Weight: addressParts.weight || '',
                            Pieces: addressParts.pieces || ''
                        };
                        
                        processedData.push(entry);
                    });
                    
                    resolve(processedData);
                } catch (error) {
                    console.error('Error procesando XLSX:', error);
                    reject(new Error('Error al procesar el archivo Excel: ' + error.message));
                }
            };
            
            reader.onerror = function() {
                reject(new Error('Error al leer el archivo Excel'));
            };
            
            reader.readAsArrayBuffer(file);
        } else {
            // Para archivos CSV (mantener el código original)
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
                reject(new Error('Error al leer el archivo CSV'));
            };
            
            reader.readAsText(file);
        }
    });
}

// Función para extraer partes de dirección del formato proporcionado
function extractAddressParts(row) {
    // Intentar manejar diferentes formatos de dirección en Excel
    let address = '';
    let city = '';
    let state = '';
    let zip = '';
    let deliverBy = '';
    let weight = '';
    let pieces = '';
    
    // 1. Detectar campos por nombre de columna (caso insensitivo)
    const keyMapping = {};
    const possibleKeys = {
        address: ['address', 'direccion', 'dirección', 'calle', 'street', 'addr', 'location', 'ubicacion', 'ubicación'],
        city: ['city', 'ciudad', 'town', 'locality', 'localidad', 'poblacion', 'población'],
        state: ['state', 'estado', 'provincia', 'region', 'región'], 
        zip: ['zip', 'zipcode', 'postal', 'codigo postal', 'código postal', 'cp', 'postcode'],
        deliverBy: ['deliverby', 'delivery by', 'entregar antes de', 'entregar por', 'hora de entrega', 'delivery time', 'tiempo de entrega'],
        weight: ['weight', 'peso', 'kg', 'lb', 'pounds', 'kilos'],
        pieces: ['pieces', 'piezas', 'items', 'articulos', 'artículos', 'cantidad', 'quantity', 'qty', 'count']
    };
    
    // Mapear las claves del objeto a nuestras categorías
    for (const key in row) {
        const lowKey = key.toLowerCase().replace(/\\s/g, '');
        for (const [category, possibleNames] of Object.entries(possibleKeys)) {
            if (possibleNames.some(name => lowKey.includes(name))) {
                keyMapping[category] = key;
                break;
            }
        }
    }
    
    // 2. Extraer información basada en el mapeo de claves
    if (keyMapping.address && typeof row[keyMapping.address] === 'string') {
        address = row[keyMapping.address].trim();
    }
    
    if (keyMapping.city && typeof row[keyMapping.city] === 'string') {
        city = row[keyMapping.city].trim();
    }
    
    if (keyMapping.state && typeof row[keyMapping.state] === 'string') {
        state = row[keyMapping.state].trim();
    }
    
    if (keyMapping.zip && typeof row[keyMapping.zip] === 'string') {
        zip = row[keyMapping.zip].trim();
    }
    
    if (keyMapping.deliverBy && typeof row[keyMapping.deliverBy] === 'string') {
        deliverBy = row[keyMapping.deliverBy].trim();
    }
    
    if (keyMapping.weight && typeof row[keyMapping.weight] !== undefined) {
        weight = String(row[keyMapping.weight]).trim();
    }
    
    if (keyMapping.pieces && typeof row[keyMapping.pieces] !== undefined) {
        pieces = String(row[keyMapping.pieces]).trim();
    }
    
    // 3. Análisis avanzado de campos sin nombre claro
    // Definir varios patrones para reconocer tipos de datos
    const patterns = {
        // Patrón para dirección típica de calle (números seguidos de texto)
        streetAddress: /^\\s*\\d+\\s+[A-Za-z0-9\\s.,'-]+/i,
        
        // Patrón para código postal de 5 dígitos
        zipCode: /\\b(\\d{5})\\b/,
        
        // Patrón para ciudad seguida de ZIP
        cityZip: /([A-Za-z\\s.'-]+)\\s*(\\d{5})/i,
        
        // Patrón para ciudad, estado ZIP
        cityStateZip: /([A-Za-z\\s.'-]+),?\\s*([A-Z]{2})\\s*(\\d{5})/i,
        
        // Patrón para una ciudad
        cityOnly: /^[A-Za-z\\s.'-]{2,}$/i,
        
        // Patrón para hora de entrega
        deliveryTime: /\\b([0-9]{1,2}:[0-9]{2}\\s*(?:AM|PM|am|pm))\\b|\\b([0-9]{1,2}\\s*(?:AM|PM|am|pm))\\b/
    };
    
    // Extraer direcciones de campos que contengan números de calle, ignorando nombres y otra información
    for (const key in row) {
        const value = String(row[key]).trim();
        if (!value) continue;
        
        // Priorizar la búsqueda de dirección completa (Calle, Ciudad, Estado ZIP)
        const cityStateZipMatch = value.match(patterns.cityStateZip);
        if (cityStateZipMatch) {
            if (!city) city = cityStateZipMatch[1].trim();
            if (!state) state = cityStateZipMatch[2].trim();
            if (!zip) zip = cityStateZipMatch[3].trim();
            
            // Buscar una posible dirección de calle antes de la parte de ciudad/estado/zip
            const beforeCityPart = value.split(cityStateZipMatch[0])[0].trim();
            if (beforeCityPart && patterns.streetAddress.test(beforeCityPart)) {
                address = beforeCityPart;
            }
            continue;
        }
        
        // Buscar ciudad y código postal
        const cityZipMatch = value.match(patterns.cityZip);
        if (cityZipMatch && !cityStateZipMatch) {
            if (!city) city = cityZipMatch[1].trim();
            if (!zip) zip = cityZipMatch[2].trim();
            
            // Buscar una posible dirección de calle antes de la parte de ciudad/zip
            const beforeCityPart = value.split(cityZipMatch[0])[0].trim();
            if (beforeCityPart && patterns.streetAddress.test(beforeCityPart)) {
                address = beforeCityPart;
            }
            continue;
        }
        
        // Buscar dirección de calle (prioridad alta)
        if (!address && patterns.streetAddress.test(value)) {
            // Extraer solo la parte que parece una dirección de calle
            const streetMatch = value.match(patterns.streetAddress);
            if (streetMatch) {
                address = streetMatch[0].trim();
                
                // Verificar si después de la dirección hay información de ciudad/zip
                const afterStreet = value.substring(streetMatch[0].length).trim();
                if (afterStreet) {
                    // Buscar ciudad+zip después de la dirección
                    const remainingCityZip = afterStreet.match(patterns.cityZip);
                    if (remainingCityZip) {
                        if (!city) city = remainingCityZip[1].trim();
                        if (!zip) zip = remainingCityZip[2].trim();
                    } else {
                        // Si solo parece ser una ciudad
                        if (!city && patterns.cityOnly.test(afterStreet)) {
                            city = afterStreet;
                        }
                    }
                }
            }
            continue;
        }
        
        // Buscar código postal si aún no se ha encontrado
        if (!zip && patterns.zipCode.test(value)) {
            zip = value.match(patterns.zipCode)[1];
            // Si el valor solo contiene el código postal y otra información, podría ser parte de la ciudad
            if (value.length > zip.length + 5 && !city) {
                const possibleCity = value.replace(zip, '').trim().replace(/[,.]$/, '');
                if (patterns.cityOnly.test(possibleCity)) {
                    city = possibleCity;
                }
            }
            continue;
        }
        
        // Buscar hora de entrega
        if (!deliverBy && patterns.deliveryTime.test(value)) {
            const timeMatch = value.match(patterns.deliveryTime);
            deliverBy = (timeMatch[1] || timeMatch[2]).trim();
            continue;
        }
        
        // Si parece ser solo una ciudad
        if (!city && patterns.cityOnly.test(value) && value.length > 2) {
            city = value;
            continue;
        }
    }
    
    // 4. Analizar campos combinados (como direcciones completas con varias partes)
    for (const key in row) {
        const value = String(row[key]).trim();
        if (value.length < 10) continue; // Ignorar campos muy cortos
        
        // Buscar patrones de dirección en campos largos
        if (!address || !city || !zip) {
            // Buscar dirección numérica en el texto
            const numericAddressMatch = value.match(/\\b\\d+\\s+[A-Za-z0-9\\s.,'-]+?(?=\\s+(?:[A-Za-z]+|,))/i);
            if (numericAddressMatch && !address) {
                address = numericAddressMatch[0].trim();
                
                // Buscar ciudad/estado/zip después de la dirección
                const afterAddress = value.substring(value.indexOf(address) + address.length).trim();
                if (afterAddress) {
                    // Buscar Ciudad, Estado ZIP
                    const csz = afterAddress.match(patterns.cityStateZip);
                    if (csz) {
                        if (!city) city = csz[1].trim();
                        if (!state) state = csz[2].trim();
                        if (!zip) zip = csz[3].trim();
                    } else {
                        // Buscar Ciudad ZIP
                        const cz = afterAddress.match(patterns.cityZip);
                        if (cz) {
                            if (!city) city = cz[1].trim();
                            if (!zip) zip = cz[2].trim();
                        }
                    }
                }
            }
        }
    }
    
    // 5. Último intento: buscar en todos los valores de texto concatenados
    if (!address || !city || !zip) {
        let fullText = '';
        
        // Concatenar todos los valores de texto
        for (const key in row) {
            const val = row[key];
            if (typeof val === 'string') {
                fullText += ' ' + val;
            }
        }
        
        if (fullText) {
            // Buscar dirección de calle si falta
            if (!address) {
                const streetMatch = fullText.match(/\\b\\d+\\s+[A-Za-z0-9\\s.,'-]+?(?=\\s+(?:[A-Za-z]+|,))/i);
                if (streetMatch) address = streetMatch[0].trim();
            }
            
            // Buscar ciudad, estado, zip si faltan
            if (!city || !state || !zip) {
                const csz = fullText.match(/([A-Za-z\\s.'-]+)[,\\s]+([A-Z]{2})[,\\s]+(\\d{5})/i);
                if (csz) {
                    if (!city) city = csz[1].trim();
                    if (!state) state = csz[2].trim();
                    if (!zip) zip = csz[3].trim();
                } else if (!city || !zip) {
                    // Buscar ciudad y zip
                    const cz = fullText.match(/([A-Za-z\\s.'-]+)[,\\s]+(\\d{5})/i);
                    if (cz) {
                        if (!city) city = cz[1].trim();
                        if (!zip) zip = cz[2].trim();
                    }
                }
            }
        }
    }
    
    // 6. Valores por defecto y limpieza
    // Por defecto estado de Washington si no se especifica
    if (!state || state.toUpperCase() === 'WA') state = 'WA';
    
    // Aplicar mayúsculas y minúsculas apropiadas
    if (city) {
        // Convertir ciudad a formato Título (primera letra de cada palabra en mayúscula)
        city = city.replace(/\\w\\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    }
    
    // Asegurarse de que el estado esté en mayúsculas
    if (state) {
        state = state.toUpperCase();
    }
    
    // Si tenemos una dirección que parece tener un nombre al principio, intentamos extraer solo la parte de la dirección física
    if (address) {
        // Buscar el primer número en la dirección, que probablemente indica donde comienza la dirección real
        const numberMatch = address.match(/(^|\\s)(\\d+\\s+[A-Za-z0-9\\s.,'-]+)/);
        if (numberMatch && numberMatch[2]) {
            // Si encontramos un número de calle, nos quedamos solo con esa parte y lo que sigue
            address = numberMatch[2].trim();
        }
    }
    
    return { 
        address, 
        city, 
        state, 
        zip,
        deliverBy,
        weight,
        pieces
    };
}

// Función para determinar si una dirección es residencial o de negocios
function determineLocationType(location) {
    // Si tenemos un campo específico para el tipo, lo usamos
    if (location.Type) {
        return location.Type;
    }
    
    // De lo contrario, intentamos determinar por la dirección
    // Las direcciones residenciales suelen tener términos como Ave, St, Road, etc.
    // Las direcciones comerciales pueden tener términos como Suite, Plaza, Mall, etc.
    const address = (location.Address1 || '').toLowerCase();
    
    // Palabras clave que sugieren un negocio
    const businessKeywords = [
        'suite', 'ste', 'plaza', 'mall', 'center', 'centre', 'building', 'office', 
        'complex', 'tower', 'blvd', 'boulevard', 'commercial', 'store', 'shop', 
        'local', 'unidad', 'unit', 'poligono', 'industrial', 'business', 'negocio',
        'comercial', 'empresa', 'corporate', 'corporativo', 'inc', 'llc', 'ltd', 'sa', 'sl'
    ];
    
    // Verificar si contiene palabras clave de negocios
    for (const keyword of businessKeywords) {
        if (address.includes(keyword)) {
            return 'Negocio';
        }
    }
    
    // Por defecto, consideramos que es residencial
    return 'Residencia';
}

// Función para generar y descargar el archivo CSV con los resultados
function downloadCSV(locations) {
    if (!locations || locations.length === 0) {
        showStatus('No hay datos para descargar. Procesa primero los datos.', 'error');
        return;
    }
    
    // Crear el contenido del CSV
    const headers = ['Orden', 'Dirección', 'Distancia (km)', 'Tipo'];
    let csvContent = headers.join(',') + '\\n';
    
    locations.forEach((location, index) => {
        // Escapar comillas en los campos de texto para CSV
        const address = location.Address1 ? `"${location.Address1.replace(/"/g, '""')}"` : '';
        const city = location.City ? `"${location.City.replace(/"/g, '""')}"` : '';
        const state = location.State ? `"${location.State.replace(/"/g, '""')}"` : '';
        const zip = location.Zip ? `"${location.Zip.replace(/"/g, '""')}"` : '';
        // Formatear la distancia
        const distance = location.distanceText || location.distance.toFixed(2) + ' km';
        // Determinar el tipo de ubicación
        const locationType = location.locationType || determineLocationType(location);
        
        // Crear la fila CSV
        const row = [
            index + 1,
            address,
            `"${distance.replace(/"/g, '""')}"`,
            `"${locationType}"`
        ];
        
        csvContent += row.join(',') + '\\n';
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
window.DataHandler = {
    readCSV,
    extractAddressParts,
    determineLocationType,
    downloadCSV
};