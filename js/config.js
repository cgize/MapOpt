// Módulo de configuración para MapOpt

// Valores predeterminados de configuración
const defaultConfig = {
    // API de Google Maps
    apiKey: 'AIzaSyCo8mS75n9JrwaaV_CZZv0HUd41yY83bmw', // Usar la misma clave del archivo config.js existente
    
    // Algoritmo de optimización - solo vecino más cercano
    optimizationAlgorithm: 'nearest',
    
    // Preferencias de ruta
    routePreferences: {
        avoidTolls: false,
        avoidHighways: false,
        transportMode: 'driving'
    }
};

// Objeto para mantener la configuración actual
let currentConfig = { ...defaultConfig };

// Función para cargar configuración desde localStorage
function loadConfig() {
    try {
        const savedConfig = localStorage.getItem('mapOptConfig');
        if (savedConfig) {
            currentConfig = JSON.parse(savedConfig);
            
            // Actualizar interfaz con valores guardados
            const apiKeyInput = document.getElementById('apiKey');
            
            if (apiKeyInput) apiKeyInput.value = currentConfig.apiKey || '';
            
            // Siempre establecer el algoritmo como "nearest"
            currentConfig.optimizationAlgorithm = 'nearest';
            
            // Preferencias de ruta
            if (currentConfig.routePreferences) {
                const avoidTollsInput = document.getElementById('avoidTolls');
                const avoidHighwaysInput = document.getElementById('avoidHighways');
                const transportModeSelect = document.getElementById('transportMode');
                
                if (avoidTollsInput) avoidTollsInput.checked = currentConfig.routePreferences.avoidTolls || false;
                if (avoidHighwaysInput) avoidHighwaysInput.checked = currentConfig.routePreferences.avoidHighways || false;
                if (transportModeSelect) transportModeSelect.value = currentConfig.routePreferences.transportMode || 'driving';
            }
        }
    } catch (error) {
        console.error('Error al cargar la configuración:', error);
        // Si hay error, usar configuración predeterminada
        currentConfig = { ...defaultConfig };
    }
}

// Función para guardar la configuración
function saveConfig() {
    try {
        // Obtener valores de la interfaz
        const apiKeyInput = document.getElementById('apiKey');
        const avoidTollsInput = document.getElementById('avoidTolls');
        const avoidHighwaysInput = document.getElementById('avoidHighways');
        const transportModeSelect = document.getElementById('transportMode');
        
        if (apiKeyInput) currentConfig.apiKey = apiKeyInput.value.trim();
        
        // Siempre usar vecino más cercano
        currentConfig.optimizationAlgorithm = 'nearest';
        
        // Preferencias de ruta
        currentConfig.routePreferences = {
            avoidTolls: avoidTollsInput?.checked || false,
            avoidHighways: avoidHighwaysInput?.checked || false,
            transportMode: transportModeSelect?.value || 'driving'
        };
        
        // Guardar en localStorage
        localStorage.setItem('mapOptConfig', JSON.stringify(currentConfig));
        
        // Actualizar configuración de Google Maps si es necesario
        if (window.MapModule && typeof window.MapModule.updateMapConfig === 'function') {
            window.MapModule.updateMapConfig(currentConfig);
        }
        
        showStatus('Configuración guardada correctamente', 'success');
    } catch (error) {
        console.error('Error al guardar la configuración:', error);
        showStatus('Error al guardar la configuración', 'error');
    }
}

// Función para restaurar valores predeterminados
function resetConfig() {
    currentConfig = { ...defaultConfig };
    
    // Actualizar interfaz con valores predeterminados
    const apiKeyInput = document.getElementById('apiKey');
    const avoidTollsInput = document.getElementById('avoidTolls');
    const avoidHighwaysInput = document.getElementById('avoidHighways');
    const transportModeSelect = document.getElementById('transportMode');
    
    if (apiKeyInput) apiKeyInput.value = defaultConfig.apiKey;
    
    // Preferencias de ruta
    if (avoidTollsInput) avoidTollsInput.checked = defaultConfig.routePreferences.avoidTolls;
    if (avoidHighwaysInput) avoidHighwaysInput.checked = defaultConfig.routePreferences.avoidHighways;
    if (transportModeSelect) transportModeSelect.value = defaultConfig.routePreferences.transportMode;
    
    showStatus('Configuración restaurada a valores predeterminados', 'success');
}

// Función para obtener la configuración actual
function getConfig() {
    return { ...currentConfig };
}

// Inicializar manipulador de eventos para la modal
function initConfigModal() {
    const modal = document.getElementById('configModal');
    const btnConfig = document.getElementById('configButton');
    const btnSave = document.getElementById('saveConfig');
    const btnReset = document.getElementById('resetConfig');
    const span = document.getElementsByClassName('close')[0];
    
    if (!modal || !btnConfig) {
        console.error('Elementos de configuración no encontrados en el DOM');
        return;
    }
    
    // Abrir modal
    btnConfig.onclick = function() {
        modal.style.display = 'block';
        loadConfig(); // Cargar configuración al abrir
    }
    
    // Cerrar modal con X
    if (span) {
        span.onclick = function() {
            modal.style.display = 'none';
        }
    }
    
    // Cerrar modal haciendo clic fuera
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    }
    
    // Guardar configuración
    if (btnSave) {
        btnSave.onclick = function() {
            saveConfig();
            modal.style.display = 'none';
        }
    }
    
    // Restaurar valores predeterminados
    if (btnReset) {
        btnReset.onclick = function() {
            resetConfig();
        }
    }
    
    // Auto-guardado para otros controles
    const autoSaveControls = [
        document.getElementById('avoidTolls'),
        document.getElementById('avoidHighways'),
        document.getElementById('transportMode')
    ];
    
    autoSaveControls.forEach(control => {
        if (control) {
            if (control.type === 'checkbox') {
                control.onchange = function() {
                    setTimeout(saveConfig, 500);
                }
            } else {
                control.onchange = function() {
                    setTimeout(saveConfig, 500);
                }
            }
        }
    });
    
    // Para la API key, guardar cuando pierda el foco (ya que es un campo de texto)
    const apiKeyInput = document.getElementById('apiKey');
    if (apiKeyInput) {
        apiKeyInput.onblur = function() {
            setTimeout(saveConfig, 500);
        }
    }
}

// Exportar funciones y variables
window.ConfigModule = {
    initConfigModal,
    getConfig,
    loadConfig,
    saveConfig,
    resetConfig
};