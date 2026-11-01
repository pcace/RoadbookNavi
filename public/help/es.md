# Usar RoadbookNavi

Planifica una salida, conviértela en un roadbook y úsalo en tu moto, coche o bicicleta. No necesitas una cuenta.

## Encuentra lo que necesitas

- **Tengo una idea para una salida:** [De una idea a un roadbook](#de-una-idea-a-un-roadbook).
- **Quiero cambiar el nombre:** [Renombrar un roadbook](#renombrar-un-roadbook).
- **Quiero quitar un roadbook:** [Eliminar un roadbook](#eliminar-un-roadbook).
- **Necesito un archivo para llevarlo conmigo:** [Exportar un roadbook](#exportar-un-roadbook).
- **Me han enviado un archivo GPX:** [Usar un trazado GPX](#usar-un-trazado-gpx).
- **Me han enviado un archivo RN2:** [Abrir un roadbook recibido](#abrir-un-roadbook-recibido).
- **Estoy listo para salir:** [Preparar una salida](#preparar-una-salida).
- **Algo no funciona:** [Resolver un problema](#resolver-un-problema).

Esta guía cubre la versión web y la aplicación instalada. Las diferencias se explican cuando son relevantes. Las capturas muestran un ejemplo real en la región alemana de Eifel: **Adenau → Nürburg**. Pulsa una imagen pequeña para abrir la captura completa. Las flechas naranjas señalan los controles descritos. Las imágenes muestran la interfaz en alemán; las instrucciones indican los nombres correspondientes en español.

## De una idea a un roadbook

**Ejemplo:** Quieres ir de Adenau a Nürburg y crear un roadbook para la salida.

1. Abre **Planificación de rutas** con el icono del mapa de la parte inferior.
2. Selecciona **Nuevo roadbook**.
3. Elige uno de los **perfiles de ruta** incluidos. Este ejemplo usa **enduro-easy**. El perfil influye en el trazado; comprueba que el resultado sea adecuado para tu vehículo y tu salida.
4. Busca **Adenau** o mueve el mapa hasta tu punto de partida. Añade el primer punto.
5. Busca **Nürburg** o añade el destino en el mapa. Con al menos dos puntos, la aplicación calcula la conexión entre ellos.
6. Revisa la ruta. Añade puntos intermedios para pasar por un lugar o una carretera concretos.
7. Pulsa el botón verde **Guardar roadbook**.
8. Introduce un nombre útil, como **Eifel: Adenau – Nürburg**, y confirma con **Guardar**.
9. Espera a que aparezca el roadbook. La primera creación puede tardar más mientras la aplicación prepara los datos y los dibujos de cruces.

[![Planificador: la flecha 1 señala el perfil de ruta, la 2 los puntos y la 3 Guardar roadbook.](images/planning-small.jpg)](images/planning.jpg)

_1: Elige un perfil. 2: Comprueba la salida y el destino. 3: Crea y guarda el roadbook._

[![Diálogo de guardado con el nombre Eifel: Adenau – Nürburg. Las flechas señalan el campo del nombre y Guardar.](images/create-small.jpg)](images/create.jpg)

_Esto guarda un proyecto en la aplicación. Exportar un archivo es un paso independiente._

**Resultado:** Tu proyecto aparece en **Lista de roadbooks**, listo para abrirlo con **Cargar y navegar**.

## Renombrar un roadbook

**Ejemplo:** Cambiar «Eifel: Adenau – Nürburg» por «Eifel: salida del domingo».

1. Abre **Planificación de rutas**.
2. Elige el proyecto guardado en **Seleccionar roadbook**.
3. Abre el pequeño engranaje de **Acciones del roadbook** junto al selector.
4. Elige **Renombrar**.
5. Introduce el nuevo nombre y confirma con **Guardar**.

[![Acciones del roadbook: la flecha 1 señala el engranaje y la 2 Renombrar.](images/actions-small.jpg)](images/actions.jpg)

[![Diálogo para cambiar el nombre. Las flechas señalan el nombre y Guardar.](images/rename-small.jpg)](images/rename.jpg)

_Esto cambia el nombre del proyecto en la aplicación. Los archivos exportados anteriormente conservan sus nombres._

## Eliminar un roadbook

**Ejemplo:** Ya no necesitas una antigua ruta de prueba.

Si podrías volver a necesitarla, [exporta primero una copia RN2](#exportar-un-roadbook).

1. Abre **Planificación de rutas**.
2. Selecciona el roadbook que quieres quitar.
3. Abre el engranaje de **Acciones del roadbook** junto al selector.
4. Elige **Eliminar**.
5. Comprueba el roadbook seleccionado arriba a la izquierda y confirma la eliminación en el diálogo.

[![Diálogo de eliminación: la flecha 1 señala el roadbook seleccionado arriba a la izquierda y la 2 Eliminar.](images/delete-small.jpg)](images/delete.jpg)

> No hay papelera. **Lista de roadbooks → Opciones → Eliminar** elimina actualmente el proyecto de inmediato, sin otro diálogo de confirmación. No se borran los archivos exportados en tu dispositivo.

## Exportar un roadbook

**Ejemplo:** Planificas en un ordenador y quieres usar el roadbook en otro dispositivo o imprimirlo.

1. Abre **Lista de roadbooks** con el icono de lista de la parte inferior.
2. Busca tu roadbook.
3. Pulsa el icono de disquete **Guardar**. También puedes usar **Opciones → Exportar…**.
4. Elige un formato.
5. Pulsa **Exportar…** y espera al archivo.
6. En la versión web, búscalo en las descargas del navegador. La aplicación instalada permite elegir una ubicación.

[![Lista de roadbooks: la flecha 1 señala Cargar y navegar, la 2 el icono de exportación y la 3 Opciones.](images/library-small.jpg)](images/library.jpg)

[![Diálogo de exportación con RN2, PDF A5, PDF en rollo, GPX y GeoJSON. Las flechas señalan los formatos y Exportar.](images/export-small.jpg)](images/export.jpg)

| Quiero…                                                                 | Elige                            |
| ----------------------------------------------------------------------- | -------------------------------- |
| Hacer una copia o abrir el roadbook en RoadbookNavi en otro dispositivo | **RallyNavigator (\*.rn2)**      |
| Imprimir páginas individuales                                           | **PDF (\*.pdf, A5 vertical)**    |
| Usar un rollo de papel continuo                                         | **PDF (\*.pdf, rollo continuo)** |
| Usar el trazado en otra aplicación de mapas o navegación                | **GPX Track (\*.gpx)**           |
| Usar el trazado en un programa compatible con GeoJSON                   | **GeoJSON (\*.geojson)**         |

**RN2** contiene las viñetas y los dibujos del roadbook. **GPX y GeoJSON** contienen el trazado, en lugar del roadbook completo. **PDF** sirve para leer o imprimir.

Para un PDF A5, elige un tamaño de papel adecuado y revisa la vista previa de impresión. Un PDF en rollo necesita ajustes de impresión adecuados para tu impresora y tu rollo.

## Abrir o instalar la aplicación

[Abre RoadbookNavi en el navegador](https://roadbooknavi.de/app/?lng=es) o [descarga la aplicación instalada](https://roadbooknavi.de/?lng=es#download).

| Dispositivo                    | Descarga                                                   |
| ------------------------------ | ---------------------------------------------------------- |
| PC Windows con procesador x64  | Instalador Windows **.exe**                                |
| Mac con Apple Silicon          | macOS **.dmg**                                             |
| PC Linux con procesador x86_64 | **.AppImage** o **.deb** para Debian/Ubuntu                |
| Dispositivo Android ARM64      | Android **.apk**                                           |
| iPhone o iPad                  | Versión en el navegador; no hay aplicación nativa para iOS |

Abre el archivo descargado y sigue los pasos de instalación de tu sistema. En Mac, arrastra la aplicación desde el DMG abierto a **Aplicaciones**. En Linux, el AppImage debe tener permiso de ejecución. En Android, abre el APK para iniciar la instalación.

**¿Qué versión debo usar?** Los controles básicos son los mismos. El navegador necesita internet para calcular nuevas rutas. La aplicación instalada puede calcular sin conexión si ya se han descargado los datos de la zona necesarios. Prepara tu primera salida en casa con conexión.

## Orientarse en la aplicación

Los iconos inferiores dan acceso a:

| Icono         | Abre                                                                      |
| ------------- | ------------------------------------------------------------------------- |
| Libro         | **Roadbook** para lectura y navegación                                    |
| Mapa          | **Planificación de rutas** con puntos y perfiles                          |
| Lista         | **Lista de roadbooks** con proyectos guardados, importación y exportación |
| Engranaje     | **Ajustes** de pantalla y controles                                       |
| Interrogación | Esta guía de **Ayuda**                                                    |

Usa **Volver a la aplicación** en la navegación de la ayuda para volver a la vista anterior. Leer la ayuda no reinicia el cuentakilómetros.

La vista del roadbook tiene dos controles adicionales abajo a la izquierda: el **icono de ubicación para el seguimiento automático** y el **icono de regla para mostrar u ocultar la zona del cuentakilómetros**.

## Ajustar los puntos y la ruta

### Añadir puntos en el mapa

Haz clic o toca un lugar. El primer punto es la salida y el último el destino. Necesitas al menos dos puntos.

Un punto nuevo puede insertarse en un tramo adecuado de la ruta existente. Revisa después la lista numerada: su orden determina la ruta.

### Mover o quitar puntos

- **Mover:** Arrastra un marcador a la nueva ubicación.
- **Quitar:** Pulsa un marcador o la **×** junto a su entrada en la lista.
- **Reordenar:** Arrastra el asa de la izquierda de una entrada hacia arriba o abajo.
- **Insertar un punto intermedio:** Pulsa sobre la ruta.
- **Cambiar el trazado:** Arrastra un tramo de la ruta a otro lugar para crear un punto adicional.

[![Lista de puntos: la flecha 1 señala el asa para reordenar y la 2 el botón para quitar.](images/waypoints-small.jpg)](images/waypoints.jpg)

La aplicación recalcula después de un cambio. Pulsar un marcador existente lo elimina; arrástralo cuando quieras moverlo.

### Ajustar una ruta guardada

Selecciónala en el planificador o usa **Lista de roadbooks → Opciones → Editar**. Cambia los puntos o el perfil y elige **Guardar cambios**. Mientras haya cambios pendientes, la **X** roja junto al botón verde de guardado los descarta.

Esto cambia la ruta. No hay editor de dibujos o texto para viñetas o indicaciones individuales.

### Crear una variante

Selecciona el proyecto en el planificador y usa **Acciones del roadbook → Duplicar**. Esto crea un proyecto independiente para una variante de la ruta. Para conservar un roadbook RN2 importado completo como copia de seguridad, usa la exportación RN2.

## Buscar lugares y usar tu ubicación

1. Escribe al menos tres caracteres en la búsqueda de direcciones, por ejemplo **Adenau**.
2. Pulsa **Intro** o **Buscar**.
3. Selecciona un resultado para añadirlo como punto.

La búsqueda se realiza al enviarla, no mientras escribes.

[![Búsqueda de Adenau: la flecha 1 señala el campo de búsqueda, la 2 Buscar y la 3 un resultado.](images/search-small.jpg)](images/search.jpg)

**Añadir posición actual** añade un punto en tu ubicación. El icono de ubicación a la derecha del mapa mueve el mapa hasta tu posición. Ambas funciones necesitan una posición del dispositivo y permiso para usarla.

La búsqueda de direcciones necesita conexión y que esté activada la **Búsqueda de lugares en línea**. Puedes colocar puntos directamente en el mapa sin usar la búsqueda.

## Elegir un perfil de ruta y un mapa

El perfil de ruta determina cómo se conectan los puntos. No cambia los roadbooks que ya hayas impreso.

La versión web ofrece **trekking** y los perfiles Enduro incluidos **enduro-easy**, **enduro-medium**, **enduro-hard**, **enduro** y **enduro_new**. La aplicación instalada puede ofrecer más perfiles BRouter incluidos.

Prueba un perfil, revisa el resultado y compara con otro si hace falta. El nombre del perfil no garantiza la dificultad real ni la idoneidad del recorrido. No puedes añadir tus propios archivos de perfil desde la interfaz.

El icono de mapa de la derecha ofrece **Liberty**, **Bright**, **Positron**, **Dark**, **Fiord**, **Liberty 3D** y **Natural Earth · Relieve**. El estilo cambia la visualización, no la ruta. El relieve sirve como vista general.

[![Selección del estilo de mapa: la flecha señala el menú de visualizaciones disponibles.](images/map-small.jpg)](images/map.jpg)

Usa **+ / −** para el zoom y el icono de brújula para orientar el mapa al norte. Define el mapa y perfil predeterminados en **Ajustes → Aplicación**.

## Comprobar distancias y superficies

Abre **Detalles (i)** junto al botón verde de guardado. Muestra la longitud, el porcentaje estimado fuera de asfalto y las longitudes de las superficies detectadas. Los colores de la ruta corresponden a esas superficies.

[![Análisis de la ruta de Eifel. Las flechas señalan Detalles y el desglose de superficies.](images/analysis-small.jpg)](images/analysis.jpg)

Estos valores dependen de los datos cartográficos disponibles. Si falta información sobre la superficie, puede estimarse a partir de otras características de la vía. **Desconocido no significa fuera de asfalto.** Comprueba los tramos importantes antes de salir.

## Usar un trazado GPX

**Ejemplo:** Te han enviado un trazado GPX para una salida por Eifel y quieres un roadbook.

1. Abre **Planificación de rutas → Nuevo roadbook**.
2. Pulsa **Importar trazado GPX**.
3. Selecciona el archivo **.gpx**.
4. Compara el trazado original de fondo con la ruta recién calculada.
5. Elige un perfil adecuado y mueve o añade puntos donde haga falta.
6. Pulsa **Guardar roadbook**, dale un nombre y confirma.

[![Trazado GPX: la flecha señala Importar trazado GPX en el planificador.](images/gpx-small.jpg)](images/gpx.jpg)

> GPX se usa como plantilla. La aplicación simplifica el trazado, extrae puntos y vuelve a calcular las conexiones. Por eso el roadbook puede diferir del trazado original. Revisa la ruta antes de guardarla.

Importa GPX en el **planificador**. **Abrir (.rn2)** en la lista es para roadbooks RN2.

## Abrir un roadbook recibido

1. Guarda el archivo **.rn2** en tu dispositivo.
2. Abre **Lista de roadbooks**.
3. Elige **Abrir (.rn2)** y selecciona el archivo.
4. Lee el aviso de importación y confirma.
5. Abre el proyecto importado con **Cargar y navegar**.

[![Importación RN2: la flecha señala Abrir (.rn2) en Lista de roadbooks.](images/import-small.jpg)](images/import.jpg)

Se admite RN2 versión 4. Se conservan los símbolos conocidos y las imágenes incrustadas. Los símbolos no disponibles pueden aparecer como nombres o dibujos de sustitución. No se descargan las referencias a imágenes externas.

**Compara con el original antes de salir:** Actualmente no se evalúan las correcciones manuales de distancia de RN2 ni las etiquetas inteligentes. Las distancias mostradas proceden del trazado GPS.

Los dibujos originales sin modificar se conservan en el intercambio RN2. Si cambias una ruta importada, se pueden regenerar los dibujos de los cruces afectados. Exporta antes una copia de seguridad y conserva el archivo original recibido.

## Leer un roadbook

Un roadbook describe tu ruta como una secuencia de viñetas. Síguelas en orden.

[![Roadbook de Eifel: la flecha 1 señala las distancias, la 2 una viñeta y la 3 la columna de información con el rumbo CAP.](images/roadbook-small.jpg)](images/roadbook.jpg)

- **Número de viñeta:** Coincide con el número de la pantalla de navegación.
- **Distancia grande:** Distancia total desde la salida hasta esta viñeta.
- **Número pequeño abajo a la derecha:** Distancia hasta la siguiente viñeta. Por ejemplo, 128 m totales más 426 m hasta la siguiente dan un total de 554 m en esa viñeta.
- **Viñeta:** Esquema de un cruce. El punto marca la entrada y la flecha la salida. No es un mapa orientado al norte.
- **CAP de una viñeta:** Rumbo previsto en ese lugar, en grados. Difiere del rumbo actual del campo de navegación intercambiable.
- **Notas y símbolos:** Información adicional para esta viñeta; en roadbooks importados se toma del archivo.

**Ejemplo:** El cuentakilómetros marca 2,30 km y la siguiente viñeta está en 2,50 km: faltan unos 200 m hasta su distancia en el roadbook. La pantalla de navegación puede mostrar otra distancia porque mide directamente hasta el punto objetivo.

## Preparar una salida

1. Abre **Lista de roadbooks → Cargar y navegar**.
2. Espera a que el roadbook sea visible.
3. Permite el acceso a la ubicación y comprueba que aparezcan coordenadas.
4. En la salida, compara el cuentakilómetros con el roadbook.
5. Activa el **seguimiento automático** si lo deseas.
6. Prueba los controles táctiles, el teclado o los mandos del manillar antes de salir.
7. Si vas a ir sin conexión, realiza la [comprobación sin conexión](#viajar-sin-internet).

La aplicación solicita la ubicación al abrirse. No hay que pulsar primero un botón independiente de «iniciar navegación». Volver a abrir un roadbook desde la lista, o cambiar a otro, pone el cuentakilómetros a cero.

Mantén la aplicación abierta y visible. El seguimiento fiable no está garantizado con la pantalla bloqueada, en segundo plano o sin señal de ubicación. Haz los ajustes en un lugar adecuado para detenerte.

## Ajustar y corregir el cuentakilómetros

El **cuentakilómetros** cuenta la distancia recorrida. Muestra metros por debajo de 1 km y kilómetros a partir de ahí. Avanza a partir de las lecturas de ubicación mientras te mueves.

[![Cuentakilómetros: la flecha 1 señala la mitad izquierda para reducir el valor y la 2 la derecha para aumentarlo.](images/odometer-small.jpg)](images/odometer.jpg)

- **Tocar la mitad izquierda:** Resta 10 m.
- **Tocar la mitad derecha:** Suma 10 m.
- **Mantener pulsado:** Cambia el valor de forma continua.
- **Teclado predeterminado:** **←** reduce y **→** aumenta el valor.

**Ejemplo:** En una viñeta reconocible, el roadbook indica 3,20 km pero el cuentakilómetros marca 3,16 km. Toca cuatro veces la mitad derecha para sumar 40 m.

Si está oculto, muéstralo con el **icono de regla** inferior. En **Ajustes → Interfaz → Posición del cuentakilómetros**, elige **Automático**, **Izquierda** o **Arriba**.

## Seguimiento automático y desplazamiento

El **icono de ubicación de abajo a la izquierda** activa o desactiva el seguimiento automático. Cuando está activado, el roadbook sigue al cuentakilómetros y se desplaza hasta la próxima viñeta. Corregir el cuentakilómetros también cambia la viñeta objetivo.

[![Navegación del roadbook: la flecha 1 señala el seguimiento automático y la 2 la regla que muestra u oculta las pantallas.](images/follow-small.jpg)](images/follow.jpg)

Para avanzar o retroceder manualmente, **desactiva el seguimiento automático con este icono**. Después desplázate mediante la pantalla táctil, la rueda del ratón o las teclas configuradas.

En **Ajustes → Aplicación**, elige:

- **Por viñetas:** **↑ / ↓** pasa a la viñeta anterior o siguiente.
- **Continuo:** Mantén una tecla de desplazamiento para moverte de forma continua. Ajusta la velocidad debajo.

Vuelve a activar el seguimiento automático con el icono de ubicación cuando quieras que el roadbook siga al cuentakilómetros.

## Cambiar la pantalla de navegación

Toca el campo de información junto al cuentakilómetros o debajo de él. Cada toque pasa a la vista siguiente:

1. **Siguiente viñeta:** Número, distancia directa al punto objetivo y flecha de dirección.
2. **Velocidad:** km/h, si la proporciona el dispositivo.
3. **GPS:** Latitud y longitud.
4. **Destino:** Distancia y dirección directas al destino del roadbook.
5. **Flecha norte:** Dirección del norte.
6. **CAP:** Rumbo actual de marcha o de brújula en grados.

[![Campo de navegación en modo CAP. La flecha señala la zona que debes tocar para cambiar de vista.](images/dashboard-small.jpg)](images/dashboard.jpg)

**Distancia directa significa en línea recta.** «Siguiente viñeta» y «Destino» no muestran la distancia restante por la ruta. La selección del objetivo usa el roadbook y el cuentakilómetros. Si abandonas la ruta, compruébala y corrige tú mismo el cuentakilómetros; esta pantalla no sustituye el cálculo de una ruta nueva.

Sin datos de ubicación útiles, los campos pueden estar vacíos o mostrar **—**. Los indicadores de dirección dependen de las lecturas de ubicación y brújula del dispositivo.

## Configurar teclado o mandos del manillar

Un mando de manillar puede funcionar si el dispositivo lo reconoce como teclado.

1. Conéctalo al dispositivo.
2. Abre **Ajustes → Aplicación**.
3. Pulsa la tecla mostrada para **Reducir cuentakilómetros**, **Aumentar cuentakilómetros**, **Desplazar roadbook hacia arriba** o **Desplazar roadbook hacia abajo**.
4. Pulsa la tecla deseada del teclado o mando.
5. Usa teclas diferentes para acciones diferentes.
6. Abre el roadbook y prueba los controles estando parado.

[![Ajustes de teclas: las flechas señalan los botones para cambiar las teclas del cuentakilómetros y del desplazamiento.](images/keys-small.jpg)](images/keys.jpg)

Los valores predeterminados son **← / →** para el cuentakilómetros y **↑ / ↓** para el desplazamiento. Se admiten teclas individuales; estas asignaciones no están pensadas para combinaciones con Ctrl, Alt, Mayús o Cmd. Usa el icono de ubicación de la vista del roadbook para el seguimiento automático.

## Ajustar la pantalla y las preferencias

En **Ajustes → Interfaz**:

- **Modo de color:** Claro, Oscuro o Sistema.
- **Idioma:** Alemán, inglés, español o francés.
- **Posición del cuentakilómetros:** Automático según la orientación, siempre a la Izquierda o siempre Arriba.

[![Ajustes de interfaz: las flechas señalan el tema, el idioma y la posición del cuentakilómetros.](images/appearance-small.jpg)](images/appearance.jpg)

**Ajustes → Aplicación** también contiene **Mantener pantalla encendida**, mapa y perfil predeterminados, asignaciones de teclas, modo y velocidad de desplazamiento. Mantener la pantalla encendida depende de la compatibilidad del dispositivo o navegador.

El **Umbral de proximidad** puede ajustarse entre **100 y 1000 m**. Las celdas verdes de distancia del PDF actual indican viñetas a menos de **200 m de la anterior**. Este resaltado del PDF siempre usa 200 m y no cambia con el control deslizante. Una flecha hacia abajo en una celda indica que la viñeta siguiente está igualmente cerca.

[![Ajustes de proximidad con una flecha que señala el control deslizante.](images/threshold-small.jpg)](images/threshold.jpg)

### Búsqueda de lugares en línea

En **Ajustes → Aplicación → Búsqueda de lugares en línea**, activa o desactiva la búsqueda. Si usas otro proveedor compatible, introduce la **URL del servicio Nominatim** y, si hace falta, tu propia clave API. Usa **Probar conexión** para comprobar la respuesta.

[![Búsqueda de lugares en línea: las flechas señalan el interruptor y Probar conexión.](images/search-settings-small.jpg)](images/search-settings.jpg)

Sin búsqueda en línea puedes seguir colocando puntos en el mapa; los nombres automáticos de lugares pueden sustituirse por coordenadas.

## Encontrar y guardar copias de tus roadbooks

En **Lista de roadbooks**, filtra por nombre y ordena por fecha, nombre o longitud. La fecha es la de la última modificación; las longitudes desconocidas quedan al final.

Los proyectos permanecen en este dispositivo. En la versión web también pertenecen a este navegador y sitio web concretos. Un enlace a la vista del roadbook no transfiere el proyecto a otro dispositivo.

**Haz copias regularmente:** Exporta los roadbooks importantes como **RN2** y guarda los archivos en otro lugar, por ejemplo en tus copias de seguridad. La navegación privada y borrar los datos del sitio pueden eliminar los proyectos web. Haz copias RN2 antes de borrar datos de la aplicación o cambiar de dispositivo.

## Llevar un roadbook a otro dispositivo

**Ejemplo:** Planificas en el portátil y sales con tu teléfono Android.

1. Exporta el roadbook terminado como **RN2** en el portátil.
2. Transfiere el archivo al teléfono con tu método habitual o almacenamiento personal.
3. Abre RoadbookNavi en el teléfono.
4. Importa desde **Lista de roadbooks → Abrir (.rn2)**.
5. Ábrelo una vez con **Cargar y navegar**.
6. Realiza la comprobación sin conexión antes de viajar.

No hay cuenta ni sincronización automática. Los cambios posteriores en el portátil requieren volver a exportar e importar en el otro dispositivo.

## Viajar sin internet

| Tarea                                           | Versión web                                           | Aplicación instalada                                              |
| ----------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------- |
| Ver un roadbook ya generado                     | Posible mientras la aplicación siga abierta y cargada | Posible con el roadbook local                                     |
| Iniciar la aplicación sin conexión              | No se admite                                          | Se admite                                                         |
| Calcular rutas nuevas                           | Necesita internet                                     | Posible con los datos de rutas necesarios descargados previamente |
| Generar nuevos dibujos de cruces                | Los datos que falten necesitan internet               | Los datos que falten necesitan internet                           |
| Volver a cargar el mapa o buscar lugares nuevos | Necesita internet                                     | Necesita internet                                                 |

### Comprobación sin conexión antes de una salida

1. Crea o importa el roadbook en casa con conexión.
2. Ábrelo con **Cargar y navegar**.
3. Recorre las viñetas y revisa los dibujos.
4. Desconecta internet temporalmente. Mantén abierta la aplicación web.
5. Comprueba la visualización, el desplazamiento y el acceso a la ubicación.
6. Restablece la conexión deseada antes de salir o sigue sin conexión después de una prueba satisfactoria.

La aplicación instalada descarga automáticamente los datos de zonas que falten al calcular y los reutiliza más adelante. Guardar una ruta no garantiza que cualquier ruta nueva cercana pueda calcularse sin conexión.

## Gestionar el almacenamiento y restablecer la aplicación

En **Ajustes → Aplicación**, estas acciones tienen efectos diferentes:

[![Ajustes de almacenamiento: las flechas señalan los datos geográficos, las vistas previas y el botón para restablecer la aplicación.](images/storage-small.jpg)](images/storage.jpg)

| Acción                                           | Efecto                                                                                                                             |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Teselas de OpenFreeMap → Borrar datos**        | Quita los datos de cruces descargados. Puede ser necesario descargarlos otra vez.                                                  |
| **Segmentos de rutas de BRouter → Borrar datos** | Quita los datos de rutas locales. Los nuevos cálculos nativos pueden necesitar internet. La versión web no guarda estos segmentos. |
| **Borrar vistas previas**                        | Quita las vistas previas PDF generadas. Los proyectos permanecen; habrá que preparar de nuevo su visualización.                    |
| **Restablecer y recargar**                       | Restablece preferencias y vistas previas. Se conservan los proyectos y las cachés geográficas.                                     |
| **Eliminar roadbook**                            | Quita ese proyecto. Para recuperarlo después necesitas un archivo exportado.                                                       |

Borra datos en casa con conexión para poder descargar de nuevo el contenido necesario. **Borrar los datos del sitio en el navegador** es distinto del botón de restablecimiento de la aplicación y también puede eliminar los roadbooks web guardados.

## Actualizaciones y soporte

En la aplicación instalada, abre **Ajustes → Acerca de → Buscar actualizaciones**. Si existe una actualización, **Descargar nueva versión** abre su página de descarga. Descarga e instala el paquete adecuado; el botón no lo instala automáticamente.

Recarga la versión web con conexión para actualizarla. Exporta primero los proyectos importantes como copias RN2.

Para informar de un problema, anota el dispositivo, sistema operativo, navegador o versión de la aplicación y los pasos para reproducirlo. La versión aparece en **Ajustes → Acerca de**. Usa [GitHub Issues](https://github.com/pcace/RoadbookNavi/issues) para problemas o sugerencias. Quita los datos personales de las capturas o archivos que subas públicamente.

## Resolver un problema

### No consigo obtener una ubicación

Comprueba el permiso de ubicación de la aplicación o sitio web y el servicio de ubicación del dispositivo. En el navegador, usa la dirección HTTPS de RoadbookNavi. Prueba con una vista despejada del cielo y mantén la aplicación en primer plano. Un ordenador de sobremesa puede no proporcionar una posición GPS útil.

**Acceso denegado** apunta a un problema de permisos; **Tiempo de espera agotado** o **Posición no disponible** pueden indicar falta de señal. Aun así puedes ver el mapa y los roadbooks guardados.

### El cuentakilómetros no coincide

En una viñeta reconocible, compara las distancias estando parado y ajusta con la mitad izquierda o derecha. Comprueba el valor inicial después de cambiar de roadbook. Las interrupciones largas de ubicación pueden requerir una corrección.

### El seguimiento automático apunta a la viñeta equivocada

Comprueba primero el cuentakilómetros. Desactiva el seguimiento automático, busca la viñeta correcta y compara su distancia. Corrige el cuentakilómetros y vuelve a activar el seguimiento automático.

### La búsqueda no encuentra lugares

Envía la búsqueda con **Intro** o **Buscar**. Comprueba internet y **Ajustes → Aplicación → Búsqueda de lugares en línea → Probar conexión**. Prueba un nombre más preciso o coloca los puntos directamente en el mapa.

### La ruta no se calcula

Comprueba que haya al menos dos puntos sobre vías adecuadas. Mueve ligeramente un punto problemático o prueba otro perfil incluido. El navegador necesita internet; la aplicación instalada debe descargar primero los datos de zona que falten.

### El roadbook queda vacío o muestra un error de PDF

Espera a que termine la creación y vuelve a abrir el proyecto guardado desde la lista. Si hace falta, borra solo las **Vistas previas de roadbooks** en **Ajustes → Aplicación** y vuelve a abrirlo con conexión. Exporta los proyectos importantes como RN2 antes de probar medidas de recuperación más amplias.

### Mi roadbook no aparece en otro dispositivo

Las bibliotecas no se sincronizan. Exporta un RN2 desde el dispositivo original e impórtalo en el segundo. Copiar un enlace no es suficiente.

### No encuentro el archivo exportado

Comprueba las descargas del navegador o la carpeta elegida en el diálogo de guardado. **Guardar roadbook** en el planificador crea un proyecto dentro de la aplicación; exportar desde la lista crea un archivo.

## ¿Adónde van mis datos?

Los proyectos permanecen en tu dispositivo. No hay cuenta RoadbookNavi ni subida automática de tu biblioteca.

- **Rutas web:** Los puntos y el perfil elegido se envían a brouter.de.
- **Aplicación instalada:** Las rutas se calculan en el dispositivo. Se descargan los datos de rutas y cruces que falten.
- **Mapas y datos de cruces:** El contenido necesario procede de OpenFreeMap.
- **Búsqueda de lugares en línea:** El texto de búsqueda y las coordenadas se envían al proveedor configurado. Puedes desactivar la búsqueda.

**Otras formas de leer:** [Deutsch](de.md) · [English](en.md) · [Français](fr.md) · [Markdown en GitHub](https://github.com/pcace/RoadbookNavi/blob/main/public/help/es.md) · [Sitio web de RoadbookNavi](https://roadbooknavi.de/?lng=es)

_Actualizado el 1 de noviembre de 2026. Las capturas muestran la interfaz web en alemán; los controles principales están en los mismos lugares en la aplicación instalada._
