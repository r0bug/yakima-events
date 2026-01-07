#!/bin/bash
# Setup script for yfevents.yakimafinds.com
# Run this script with sudo: sudo bash setup-nginx-ssl.sh

set -e

DOMAIN="yfevents.yakimafinds.com"
NGINX_CONF="/etc/nginx/sites-available/$DOMAIN"
PROJECT_DIR="/home/robug/yakima"

echo "=== Setting up $DOMAIN ==="

# Step 1: Install HTTP-only nginx config first
echo "[1/7] Installing HTTP-only nginx configuration..."
cp "$PROJECT_DIR/nginx-yfevents.yakimafinds.com-http.conf" "$NGINX_CONF"

# Step 2: Create symlink to enable site
echo "[2/7] Enabling site..."
ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/$DOMAIN"

# Step 3: Test nginx config
echo "[3/7] Testing nginx configuration..."
nginx -t

# Step 4: Reload nginx
echo "[4/7] Reloading nginx..."
systemctl reload nginx

# Step 5: Obtain SSL certificate
echo "[5/7] Obtaining SSL certificate..."
certbot certonly --webroot -w /var/www/html -d "$DOMAIN" --non-interactive --agree-tos --email admin@yakimafinds.com

# Step 6: Install HTTPS nginx config
echo "[6/7] Installing HTTPS nginx configuration..."
cp "$PROJECT_DIR/nginx-yfevents.yakimafinds.com.conf" "$NGINX_CONF"

# Step 7: Test and reload
echo "[7/7] Final nginx test and reload..."
nginx -t && systemctl reload nginx

echo ""
echo "=== Setup Complete ==="
echo "Site should now be accessible at https://$DOMAIN"
echo ""
echo "To verify:"
echo "  curl -I https://$DOMAIN"
