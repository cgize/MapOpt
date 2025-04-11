# Optimizador de Rutas de Reparto

Una aplicación web que permite cargar archivos CSV y Excel (XLSX) con direcciones y ordenarlas por distancia desde un punto de partida específico. Ideal para optimizar rutas de reparto.

## Formatos Soportados

### CSV
Archivo CSV tradicional con encabezados que incluyan las columnas:
- Address1: Dirección principal
- City: Ciudad
- State: Estado
- Zip: Código postal

### Excel (XLSX/XLS)
La aplicación ahora soporta archivos Excel con detección automática inteligente:

#### Reconocimiento Avanzado de Columnas
El sistema identifica inteligentemente las columnas relevantes independientemente de sus nombres exactos. Puede reconocer:

- Columnas de direcciones usando variaciones como: 'address', 'direccion', 'dirección', 'calle', 'street', etc.
- Columnas de ciudad con variaciones como: 'city', 'ciudad', 'town', 'locality', etc.
- Columnas de códigos postales como: 'zip', 'zipcode', 'postal', 'código postal', etc.
- Y muchos otros campos importantes

#### Extracción Inteligente de Direcciones
El sistema ahora enfoca su inteligencia en extraer solo la información relevante para las direcciones:

- Se centra en extraer información de dirección física (calle, ciudad, estado, código postal)
- Ignora nombres de personas y otra información personal no relevante para la ruta
- Detecta y extrae solo la parte numérica de direcciones (ej. "123 Main St")
- Limpia los datos para obtener direcciones consistentes

#### Ejemplo de Formatos Soportados
El sistema puede procesar una gran variedad de formatos, incluyendo estos ejemplos:

```
# Formato con columnas bien definidas
Recipient                   | Address             | City         | Zip    | DeliverBy | Weight | Pieces
---------------------------|---------------------|-------------|--------|-----------|--------|-------
RICHARD DICK (360) 692-0661 | 10090 OGLE RD NE    | POULSBO      | 98370  | 5:00PM    | 7      | 1
                           | 142 Camano Ln       | Port Ludlow  | 98365  | 5:00PM    | 11     | 11

# Formato con direcciones combinadas
Nombre        | Dirección                           | DeliverBy | Peso  | Piezas
--------------|-------------------------------------|-----------|-------|-------
April M.      | 161 Ann kivley drive Port hadlock 98339 | 5:00PM  | 45    | 1
CRAIG ISENBERG| 1304 V ST PORT TOWNSEND 98368     | 5:00PM    | 1     | 1

# Formato sin encabezados específicos
Luci Lytle1235 Landes StreetPort Townsend98368 5:00PM231X
CRAIG ISENBERG1304 V STPORT TOWNSEND98368 5:00PM11X
```

El sistema automáticamente extrae y estructura la información necesaria de estos formatos variados.
