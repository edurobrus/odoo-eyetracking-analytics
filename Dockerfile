# Elige la versión de Odoo que estés utilizando (ej. 16.0)
FROM odoo:16.0

# Copia tus módulos personalizados desde tu repositorio al directorio correcto en la imagen
COPY ./custom-addons /mnt/extra-addons

# Copia tu archivo de configuración de Odoo
COPY ./odoo.conf /etc/odoo/odoo.conf

# Asegurar permisos
USER root
RUN chown -R odoo:odoo /mnt/extra-addons /etc/odoo/odoo.conf && \
    chmod +x /usr/local/bin/init-odoo.sh && \
    chown odoo:odoo /usr/local/bin/init-odoo.sh

# Crear directorios necesarios
RUN mkdir -p /var/lib/odoo/.local/share/Odoo/filestore && \
    mkdir -p /var/lib/odoo/.local/share/Odoo/sessions && \
    chown -R odoo:odoo /var/lib/odoo/.local

USER odoo

# Odoo escucha en el puerto 8069 por defecto
EXPOSE 8069