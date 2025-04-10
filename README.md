# Optimizador de Rutas de Reparto

Una aplicación web que permite cargar un archivo CSV con direcciones y ordenarlas por distancia desde un punto de partida específico. Ideal para optimizar rutas de reparto.

## Características

- Carga de archivos CSV con direcciones
- Geocodificación de direcciones usando Google Maps API
- Cálculo de distancias reales de conducción
- Ordenamiento de direcciones por distancia
- Visualización de la ruta en un mapa interactivo
- Interfaz sencilla y fácil de usar

## Cómo usar

1. Abre el archivo `index.html` en tu navegador
2. Confirma o modifica el punto de partida
3. Carga tu archivo CSV con las direcciones
4. Haz clic en "Procesar y Ordenar"
5. Visualiza los resultados ordenados y la ruta en el mapa

## Estructura del CSV

El archivo CSV debe tener las siguientes columnas:
- Address1: Dirección principal
- City: Ciudad
- State: Estado
- Zip: Código postal

## Tecnologías utilizadas

- HTML, CSS y JavaScript
- Google Maps API (Geocoding, Distance Matrix, Directions)

## Configuración para GitHub Pages

Para publicar esta aplicación en GitHub Pages:

1. Sube este repositorio a GitHub
2. Ve a Settings > Pages
3. Selecciona la rama principal como fuente
4. Tu sitio estará disponible en la URL proporcionada

## Limitaciones

- Google Maps API tiene límites de uso para cuentas gratuitas
- Para rutas con más de 10 destinos, solo se muestra la ruta para los primeros 10 (limitación de la API de Directions)
