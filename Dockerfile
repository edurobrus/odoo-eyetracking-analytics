# Usa la imagen oficial de Odoo 16.0
FROM odoo:16.0

# Cambiar a root para hacer cambios
USER root

# Instalar dependencias adicionales
RUN apt-get update && apt-get install -y \
    python3-psycopg2 \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Crear directorios necesarios (SIN FILESTORE PERSISTENTE)
RUN mkdir -p /var/lib/odoo/.local/share/Odoo/sessions && \
    mkdir -p /mnt/extra-addons && \
    mkdir -p /tmp/odoo && \
    chown -R odoo:odoo /var/lib/odoo /mnt/extra-addons /tmp/odoo

# Copiar módulos personalizados
COPY ./custom-addons /mnt/extra-addons

# Copiar configuración y scripts
COPY ./odoo.conf /etc/odoo/odoo.conf
COPY ./entrypoint.sh /usr/local/bin/entrypoint.sh

# Arreglar permisos
RUN chown -R odoo:odoo /mnt/extra-addons /etc/odoo/odoo.conf && \
    chmod +x /usr/local/bin/entrypoint.sh

# Volver al usuario odoo
USER odoo

# Exponer puertos
EXPOSE 8069 8071

# Variables de entorno opcionales
ENV REGENERATE_ASSETS=false
ENV CLEAN_START=false

# Usar entrypoint
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

# Comando por defecto
CMD ["odoo"]