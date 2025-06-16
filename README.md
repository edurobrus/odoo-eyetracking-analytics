# Marketing Eye-Tracking Analytics for Odoo

![Odoo Version](https://img.shields.io/badge/Odoo-16.0-875A7B.svg?style=flat)
![License](https://img.shields.io/badge/license-LGPL--3-blue.svg?style=flat)

Un módulo avanzado de Odoo 16 para integrar el análisis de comportamiento visual mediante eye-tracking basado en webcam, diseñado para equipos de marketing y UX.

## Visión General

**marketing_eyetracking** transforma una webcam estándar en una potente herramienta de investigación de mercados. Este módulo permite a los analistas de marketing realizar estudios de eye-tracking directamente desde la interfaz de Odoo, para entender cómo los usuarios interactúan visualmente con las interfaces, campañas y productos.

A diferencia de las soluciones tradicionales que requieren hardware costoso, este proyecto utiliza tecnologías de IA de vanguardia como **WebGazer.js** para ejecutarse enteramente en el navegador del cliente, garantizando la privacidad y la accesibilidad. Tambien hemos añadido una configuracion para poder tener con google analitycs un mayor seguimiento del comportamiento de los usuarios

## 🚀 Características Principales

*   📊 **Gestión de Análisis Integrada:** Crea, gestiona y revisa estudios de eye-tracking directamente desde un nuevo menú en Odoo. Cada análisis queda asociado a un usuario y a una marca de tiempo para una trazabilidad completa.

*   📹 **Doble Modo de Captura:** Ofrece flexibilidad y control sobre la privacidad:
    *   **Modo Privado (Solo Coordenadas):** Captura únicamente las coordenadas (x, y) de la mirada. Ideal para análisis cuantitativos agregados y mapas de calor, garantizando el máximo anonimato.
    *   **Modo Cualitativo (Grabación de Pantalla):** Graba la sesión de pantalla completa (con consentimiento explícito) para un análisis de usabilidad profundo, permitiendo ver el contexto exacto de la interacción del usuario. Las grabaciones se guardan de forma segura en el filestore de Odoo.

*   🕵️ **Seguimiento de Acciones de Usuario:** Correlaciona los datos de la mirada con la navegación real del usuario dentro de Odoo. La pestaña "User Actions" muestra un log de las URLs visitadas durante la sesión de análisis, permitiendo un análisis contextual.

*   📈 **Visualización de Datos Avanzada:** Un dashboard interactivo construido con Chart.js y D3.js para un análisis visual detallado:
    *   **Mapa de Calor (Heatmap):** Visualiza las zonas de mayor atención con controles interactivos para ajustar la intensidad (`presión`) y la resolución (`grid`), facilitando la identificación de puntos calientes.
    *   **Gráfico de Dispersión:** Muestra los puntos de la mirada con filtros para gestionar y explorar subconjuntos de datos.
    *   **Análisis de Perturbación Visual:** Un gráfico que traza la evolución de las coordenadas X e Y a lo largo del tiempo, permitiendo medir la "fatiga visual" o confusión del usuario. Grandes y frecuentes saltos en la gráfica indican un diseño complejo que obliga a la vista a moverse erráticamente.
    *   **Filtros por Fecha:** Analiza los estudios realizados en periodos de tiempo específicos.

*   🔒 **Enfoque en la Privacidad:** El procesamiento de imágenes y la detección de landmarks faciales se realizan al 100% en el navegador del cliente. Ninguna imagen facial es enviada o almacenada en el servidor.

## 🛠️ Stack Tecnológico

*   **Backend:** Odoo 16, Python 3.
*   **Frontend (Módulo Odoo):** JavaScript, Framework OWL (Odoo Web Library), XML.
*   **Frontend (Cliente):** WebGazer.js, MediaPipe, Chart.js, D3.js, SweetAlert, html2canvas.
*   **Base de Datos:** PostgreSQL.
*   **Despliegue:** Docker, Render.com.

## ⚙️ Instalación y Ejecución

Sigue estos pasos para poner en marcha el proyecto en un entorno de desarrollo local.

### Requisitos Previos
*   Tener una instancia de Odoo 16 funcionando. Puedes seguir la [guía de instalación oficial](https://www.odoo.com/documentation/16.0/administration/install/install.html).
*   Tener Python 3 y `pip` instalados.

### 1. Clonar el Repositorio
Obtén el código fuente del proyecto desde GitHub.

```bash
git clone https://github.com/edurobrus/odoo-eyetracking-analytics.git
cd odoo-eyetracking-analytics
```

### 2. Configuración para Ejecución Local
Este proyecto incluye ficheros de configuración de ejemplo. Para ejecutarlo en local, copia el fichero de ejemplo.

```bash
# Copia el fichero de configuración de ejemplo para uso local
cp odoo.conf.local.example odoo.conf
```
Asegúrate de que el fichero `odoo.conf` tiene la ruta correcta a tu carpeta de `custom-addons` (que está en este repositorio).

### 3. Ejecutar Odoo
Inicia el servidor de Odoo utilizando el fichero de configuración local.

```bash
# Desde el directorio raíz del proyecto Odoo
python3 odoo-bin -c /ruta/al/repositorio/odoo-eyetracking-analytics/odoo.conf
```

### 4. Instalar el Módulo en Odoo
*   En tu navegador, accede a tu instancia de Odoo y activa el **Modo Desarrollador** (Ajustes > Activar el modo de desarrollador).
*   Ve al menú de **Apps**.
*   Haz clic en **"Actualizar lista de aplicaciones"**.
*   Busca "Marketing Eye-Tracking" (o `marketing_eyetracking`) en la barra de búsqueda.
*   Haz clic en **"Instalar"**. El módulo `web` es una dependencia y se instalará automáticamente si no lo está ya.

## 📖 Cómo Usarlo

Una vez instalado, el módulo es muy fácil de usar:

1.  **Crear un Nuevo Análisis:**
    *   Navega al nuevo menú **"Eye-Tracking"** en el panel de Odoo.
    *   Haz clic en **"Crear"**. Se creará un nuevo registro de análisis a tu nombre.

2.  **Iniciar la Sesión de Seguimiento:**
    *   Abre el análisis que acabas de crear y haz clic en el botón **"Empezar Eye-Tracking"**.
    *   Sigue las instrucciones en pantalla: concede permiso a la cámara y elige el modo de captura (con o sin grabación de pantalla).
    *   Completa el breve proceso de calibración mirando a los puntos indicados.

3.  **Ver los Resultados:**
    *   Una vez finalizada la sesión, vuelve al registro del análisis en Odoo.
    *   La pestaña **"User Actions"** te mostrará las páginas de Odoo que visitaste durante el análisis.
    *   Si elegiste el modo de grabación, el vídeo estará disponible para su reproducción.

4.  **Analizar los Gráficos:**
    *   Ve a la pestaña **"Visualización Gráfica"**.
    *   Utiliza los filtros para explorar los datos en el gráfico de dispersión y en el mapa de calor interactivo.

## ☁️ Despliegue en Render.com

Este proyecto está diseñado para ser desplegado fácilmente usando **Docker** y **Render.com**.

*   **Dockerfile:** Se proporciona un `Dockerfile` que empaqueta Odoo y el módulo personalizado.
*   **Automatización:** El despliegue a Render está automatizado mediante **GitHub Actions**. Un `push` a la rama `main` iniciará el proceso de construcción y despliegue.
*   **Configuración:** Para que funcione, es necesario configurar los `secrets` de GitHub Actions que serán utilizados durante el despliegue. Se proporciona un fichero de ejemplo `odoo.conf.render.example` como configuración de despliegue para luego copiar y desplegar con cp s`odoo.conf.render.example odoo.conf`.

## Autor

*   **Eduardo Robles Russo**

## Licencia

Este módulo se distribuye bajo la licencia **LGPL-3**.
