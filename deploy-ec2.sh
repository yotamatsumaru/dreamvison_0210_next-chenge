#!/bin/bash

# AWS EC2 Deployment Script for Streaming Platform
# This script sets up and deploys the application on a fresh EC2 instance

set -e  # Exit on error

echo "==================================="
echo "Streaming Platform - EC2 Deployment"
echo "==================================="

# Configuration Variables
APP_NAME="streaming-platform"
APP_DIR="/home/ubuntu/webapp"
NGINX_CONF="/etc/nginx/sites-available/$APP_NAME"
REPO_URL="https://github.com/yourusername/streaming-platform.git"  # Update with your repo

echo ""
echo "Step 1: System Update and Install Dependencies"
echo "-----------------------------------------------"
sudo apt update
sudo apt upgrade -y

# Install Node.js 20.x
echo "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL client
echo "Installing PostgreSQL client..."
sudo apt install -y postgresql-client

# Install Nginx
echo "Installing Nginx..."
sudo apt install -y nginx

# Install PM2 globally
echo "Installing PM2..."
sudo npm install -g pm2

echo ""
echo "Step 2: Clone Repository"
echo "------------------------"
if [ -d "$APP_DIR" ]; then
    echo "Directory $APP_DIR already exists. Pulling latest changes..."
    cd $APP_DIR
    git pull origin main
else
    echo "Cloning repository..."
    git clone $REPO_URL $APP_DIR
    cd $APP_DIR
fi

echo ""
echo "Step 3: Install Application Dependencies"
echo "-----------------------------------------"
npm install --production

echo ""
echo "Step 4: Configure Environment Variables"
echo "----------------------------------------"
if [ ! -f "$APP_DIR/.env" ]; then
    echo "Creating .env file..."
    cat > $APP_DIR/.env << 'EOF'
# PostgreSQL Database Connection
DATABASE_URL=postgresql://username:password@your-rds-endpoint:5432/streaming_platform

# Stripe Configuration
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# JWT Secret
JWT_SECRET=your_random_jwt_secret_here

# Admin Credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password_here

# Server Configuration
PORT=3000
NODE_ENV=production
EOF
    echo "⚠️  IMPORTANT: Edit $APP_DIR/.env and update with your actual credentials!"
    echo "   Use: sudo nano $APP_DIR/.env"
else
    echo ".env file already exists. Skipping..."
fi

echo ""
echo "Step 5: Database Migration"
echo "--------------------------"
echo "⚠️  Make sure your RDS PostgreSQL instance is accessible from this EC2 instance!"
echo "   Run the following commands manually after configuring DATABASE_URL:"
echo "   cd $APP_DIR"
echo "   npm run db:migrate"
echo "   npm run db:seed"

echo ""
echo "Step 6: Create Logs Directory"
echo "------------------------------"
mkdir -p $APP_DIR/logs

echo ""
echo "Step 7: Configure PM2"
echo "---------------------"
cd $APP_DIR
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup | tail -n 1 | bash

echo ""
echo "Step 8: Configure Nginx"
echo "-----------------------"
if [ ! -f "$NGINX_CONF" ]; then
    echo "Copying Nginx configuration..."
    sudo cp $APP_DIR/nginx.conf $NGINX_CONF
    
    echo "⚠️  IMPORTANT: Update the following in $NGINX_CONF:"
    echo "   - server_name (replace with your domain)"
    echo "   - SSL certificate paths (after obtaining Let's Encrypt certificate)"
    echo "   - Application directory paths if different from /home/ubuntu/webapp"
    
    # Create symlink
    sudo ln -sf $NGINX_CONF /etc/nginx/sites-enabled/$APP_NAME
    
    # Remove default Nginx site
    sudo rm -f /etc/nginx/sites-enabled/default
else
    echo "Nginx configuration already exists. Skipping..."
fi

# Test Nginx configuration
echo "Testing Nginx configuration..."
sudo nginx -t

# Restart Nginx
echo "Restarting Nginx..."
sudo systemctl restart nginx
sudo systemctl enable nginx

echo ""
echo "Step 9: Configure Firewall (UFW)"
echo "---------------------------------"
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

echo ""
echo "Step 10: SSL Certificate (Let's Encrypt)"
echo "-----------------------------------------"
echo "To obtain SSL certificate, run the following commands:"
echo "   sudo apt install -y certbot python3-certbot-nginx"
echo "   sudo certbot --nginx -d your-domain.com -d www.your-domain.com"
echo ""
echo "After obtaining certificate, uncomment HSTS header in $NGINX_CONF"

echo ""
echo "==================================="
echo "Deployment Complete!"
echo "==================================="
echo ""
echo "📝 Next Steps:"
echo "1. Edit .env file: sudo nano $APP_DIR/.env"
echo "2. Configure DATABASE_URL with your RDS endpoint"
echo "3. Run database migrations: cd $APP_DIR && npm run db:migrate"
echo "4. Seed database (optional): npm run db:seed"
echo "5. Update Nginx configuration: sudo nano $NGINX_CONF"
echo "6. Obtain SSL certificate using certbot"
echo "7. Reload Nginx: sudo systemctl reload nginx"
echo ""
echo "📊 Management Commands:"
echo "- View logs: pm2 logs $APP_NAME --nostream"
echo "- Restart app: pm2 restart $APP_NAME"
echo "- Stop app: pm2 stop $APP_NAME"
echo "- App status: pm2 status"
echo "- Nginx logs: sudo tail -f /var/log/nginx/streaming-platform-*.log"
echo ""
echo "🌐 Your application should be accessible at:"
echo "   http://your-ec2-ip"
echo "   (After SSL setup: https://your-domain.com)"
echo ""
