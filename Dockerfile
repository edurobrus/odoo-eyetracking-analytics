# Elige la versión de Odoo que estés utilizando (ej. 16.0)
FROM odoo:16.0

# Copia tus módulos personalizados desde tu repositorio al directorio correcto en la imagen
# La ruta './custom-addons' es relativa a la ubicación del Dockerfile
COPY ./custom-addons /mnt/extra-addons

# Copia tu archivo de configuración de Odoo
# La ruta './odoo.conf' es relativa a la ubicación del Dockerfile
COPY ./odoo.conf /etc/odoo/odoo.conf

# Opcional: Asegurar permisos para el usuario odoo (si es necesario)
# La imagen base de Odoo ya corre como usuario 'odoo'.
# Es buena práctica asegurarse de que los archivos copiados tengan los permisos correctos.
USER root
RUN chown -R odoo:odoo /mnt/extra-addons /etc/odoo/odoo.conf

# Si tu odoo.conf original especificaba un logfile DENTRO de custom-addons,
# y quieres mantenerlo (no recomendado para Render, es mejor log a stdout),
# asegúrate que el directorio exista y tenga permisos. Ejemplo:
# RUN mkdir -p /mnt/extra-addons/marketing_eyetracking/log && \
#     chown -R odoo:odoo /mnt/extra-addons/marketing_eyetracking/log
# Sin embargo, para Render es mejor configurar Odoo para que loguee a la consola (ver odoo.conf abajo)

USER odoo

# Odoo escucha en el puerto 8069 por defecto
EXPOSE 8069

# El comando por defecto de la imagen base de Odoo ('odoo')
CMD ["/opt/odoo/odoo-bin", "-c", "/etc/odoo/odoo.conf", "-i", "base"]