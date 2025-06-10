# Usa la imagen oficial de Odoo 16.0
FROM odoo:16.0

# Cambiar a root para hacer cambios
USER root

# Instalar dependencias adicionales si las necesitas
RUN apt-get update && apt-get install -y \
    python3-psycopg2 \
    && rm -rf /var/lib/apt/lists/*

# Crear directorios necesarios (sin filestore)
RUN mkdir -p /var/lib/odoo/.local/share/Odoo/sessions && \
    mkdir -p /mnt/extra-addons && \
    chown -R odoo:odoo /var/lib/odoo/.local /mnt/extra-addons

# Copiar módulos personalizados
COPY ./custom-addons /mnt/extra-addons

# Copiar configuración
COPY ./odoo.conf /etc/odoo/odoo.conf

# Arreglar permisos
RUN chown -R odoo:odoo /mnt/extra-addons /etc/odoo/odoo.conf /var/lib/odoo

# Volver al usuario odoo
USER odoo

# Exponer puerto
EXPOSE 8069

# Comando por defecto
CMD ["odoo", "--config=/etc/odoo/odoo.conf"]