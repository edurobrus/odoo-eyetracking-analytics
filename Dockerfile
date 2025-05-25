# Usar versión específica (mejor práctica para entornos productivos)
FROM odoo:16.0.20230704

# Variables de entorno configurables
ENV ODOO_RC /etc/odoo/odoo.conf
ENV ODOO_DATA_DIR /var/lib/odoo
ENV ODOO_ADDONS_PATH /mnt/extra-addons,/usr/lib/python3/dist-packages/odoo/addons

# Instalar dependencias del sistema y limpiar caché en un solo paso
USER root
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        python3-dev \
        libxslt1-dev \
        libldap2-dev \
        libsasl2-dev \
        libssl-dev && \
    rm -rf /var/lib/apt/lists/*

# Crear directorios con permisos correctos
RUN mkdir -p /mnt/extra-addons && \
    mkdir -p /var/log/odoo && \
    chown -R odoo:odoo /mnt/extra-addons /var/log/odoo && \
    chmod 755 /var/log/odoo

# Copiar archivos
COPY --chown=odoo:odoo ./custom-addons /mnt/extra-addons/
COPY --chown=odoo:odoo ./odoo.conf ${ODOO_RC}

# Configurar permisos y directorios de datos
RUN mkdir -p ${ODOO_DATA_DIR}/filestore ${ODOO_DATA_DIR}/sessions && \
    chown -R odoo:odoo ${ODOO_DATA_DIR} && \
    chmod -R 750 ${ODOO_DATA_DIR}

# Salud del contenedor (healthcheck)
HEALTHCHECK --interval=30s --timeout=30s --start-period=30s --retries=3 \
    CMD curl --fail http://localhost:8069/web/health || exit 1

# Puerto y usuario final
EXPOSE 8069
USER odoo