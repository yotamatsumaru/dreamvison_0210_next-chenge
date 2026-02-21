# AWS EC2 + PostgreSQL 移行ガイド

## 🎯 移行概要

**現在の構成:**
- **ホスティング**: Cloudflare Pages
- **データベース**: Cloudflare D1 (SQLite)
- **フレームワーク**: Hono + TypeScript
- **デプロイ**: Wrangler

**移行後の構成:**
- **サーバー**: AWS EC2 (Ubuntu/Amazon Linux)
- **データベース**: Amazon RDS PostgreSQL
- **フレームワーク**: Express.js + TypeScript
- **Webサーバー**: Nginx (リバースプロキシ)
- **プロセス管理**: PM2
- **SSL/TLS**: Let's Encrypt (Certbot)

---

## 📊 アーキテクチャ図

```
[ユーザー]
    ↓ HTTPS
[Route 53 (DNS)]
    ↓
[CloudFront (CDN - オプション)]
    ↓
[Application Load Balancer - オプション]
    ↓
[EC2 Instance]
    ├─ Nginx (Port 80/443)
    │   ↓ プロキシ
    ├─ Express.js (Port 3000)
    │   ↓
    └─ Static Files (/public)
    
[RDS PostgreSQL]
    ↑ 接続
[EC2 Instance]

[S3 Bucket]
    ↑ 動画/画像アップロード
[EC2 Instance]
```

---

## 🚀 移行手順（完全版）

### フェーズ1: AWS環境準備（1日）

#### 1.1 AWSアカウント・CLI設定

```bash
# AWS CLIインストール（既にインストール済みならスキップ）
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# AWS認証情報設定
aws configure
# AWS Access Key ID: [YOUR_ACCESS_KEY]
# AWS Secret Access Key: [YOUR_SECRET_KEY]
# Default region name: ap-northeast-1  # 東京リージョン
# Default output format: json
```

#### 1.2 VPCとセキュリティグループの作成

**VPC作成（AWSコンソールまたはCLI）:**

```bash
# VPC作成
aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=streaming-platform-vpc}]' \
  --region ap-northeast-1

# VPC IDを記録
VPC_ID="vpc-xxxxxxxxx"

# パブリックサブネット作成（EC2用）
aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.1.0/24 \
  --availability-zone ap-northeast-1a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=public-subnet-1a}]'

# プライベートサブネット作成（RDS用）
aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.2.0/24 \
  --availability-zone ap-northeast-1a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=private-subnet-1a}]'

aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.3.0/24 \
  --availability-zone ap-northeast-1c \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=private-subnet-1c}]'

# インターネットゲートウェイ作成・アタッチ
aws ec2 create-internet-gateway \
  --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=streaming-igw}]'

IGW_ID="igw-xxxxxxxxx"

aws ec2 attach-internet-gateway \
  --vpc-id $VPC_ID \
  --internet-gateway-id $IGW_ID
```

**セキュリティグループ作成:**

```bash
# EC2用セキュリティグループ
aws ec2 create-security-group \
  --group-name streaming-ec2-sg \
  --description "Security group for EC2 web server" \
  --vpc-id $VPC_ID

EC2_SG_ID="sg-xxxxxxxxx"

# SSH接続許可（開発時のみ、本番は踏み台サーバー推奨）
aws ec2 authorize-security-group-ingress \
  --group-id $EC2_SG_ID \
  --protocol tcp \
  --port 22 \
  --cidr 0.0.0.0/0

# HTTP接続許可
aws ec2 authorize-security-group-ingress \
  --group-id $EC2_SG_ID \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0

# HTTPS接続許可
aws ec2 authorize-security-group-ingress \
  --group-id $EC2_SG_ID \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0

# RDS用セキュリティグループ
aws ec2 create-security-group \
  --group-name streaming-rds-sg \
  --description "Security group for RDS PostgreSQL" \
  --vpc-id $VPC_ID

RDS_SG_ID="sg-yyyyyyyyy"

# PostgreSQL接続許可（EC2からのみ）
aws ec2 authorize-security-group-ingress \
  --group-id $RDS_SG_ID \
  --protocol tcp \
  --port 5432 \
  --source-group $EC2_SG_ID
```

---

### フェーズ2: RDS PostgreSQL作成（1日）

#### 2.1 DBサブネットグループ作成

```bash
aws rds create-db-subnet-group \
  --db-subnet-group-name streaming-db-subnet-group \
  --db-subnet-group-description "Subnet group for streaming platform DB" \
  --subnet-ids subnet-xxxxx subnet-yyyyy \
  --region ap-northeast-1
```

#### 2.2 RDS PostgreSQLインスタンス作成

```bash
aws rds create-db-instance \
  --db-instance-identifier streaming-platform-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 15.4 \
  --master-username dbadmin \
  --master-user-password 'YourStrongPassword123!' \
  --allocated-storage 20 \
  --storage-type gp3 \
  --storage-encrypted \
  --vpc-security-group-ids $RDS_SG_ID \
  --db-subnet-group-name streaming-db-subnet-group \
  --db-name streaming_platform \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00" \
  --preferred-maintenance-window "mon:04:00-mon:05:00" \
  --no-publicly-accessible \
  --region ap-northeast-1

# 作成完了まで10-15分待機
aws rds wait db-instance-available \
  --db-instance-identifier streaming-platform-db

# エンドポイント取得
aws rds describe-db-instances \
  --db-instance-identifier streaming-platform-db \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text
```

**RDSエンドポイント例:**
```
streaming-platform-db.xxxxxx.ap-northeast-1.rds.amazonaws.com
```

#### 2.3 PostgreSQLスキーマ作成

**スキーマファイル（db/schema.sql）:**

```sql
-- PostgreSQL Schema for Streaming Platform

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Artists table
CREATE TABLE IF NOT EXISTS artists (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    image_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_artists_slug ON artists(slug);

-- Events table
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    artist_id INTEGER NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    thumbnail_url VARCHAR(500),
    event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('live', 'archive')),
    stream_url VARCHAR(500),
    archive_url VARCHAR(500),
    cloudfront_key_pair_id VARCHAR(100),
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'ended', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_events_slug ON events(slug);
CREATE INDEX idx_events_artist_id ON events(artist_id);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_start_time ON events(start_time);

-- Tickets table
CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'JPY',
    stripe_product_id VARCHAR(255),
    stripe_price_id VARCHAR(255),
    stock INTEGER,
    sold_count INTEGER DEFAULT 0,
    sale_start TIMESTAMP WITH TIME ZONE,
    sale_end TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tickets_event_id ON tickets(event_id);

-- Purchases table
CREATE TABLE IF NOT EXISTS purchases (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    stripe_customer_id VARCHAR(255),
    stripe_checkout_session_id VARCHAR(255) UNIQUE,
    stripe_payment_intent_id VARCHAR(255),
    customer_email VARCHAR(255) NOT NULL,
    customer_name VARCHAR(255),
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'JPY',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'refunded', 'failed')),
    access_token TEXT,
    access_expires_at TIMESTAMP WITH TIME ZONE,
    purchased_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_purchases_stripe_session ON purchases(stripe_checkout_session_id);
CREATE INDEX idx_purchases_customer_email ON purchases(customer_email);
CREATE INDEX idx_purchases_access_token ON purchases(access_token);

-- Admins table
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_admins_username ON admins(username);

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_artists_updated_at BEFORE UPDATE ON artists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purchases_updated_at BEFORE UPDATE ON purchases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

**シードデータ（db/seed.sql）:**

```sql
-- Insert default admin user (password: admin123)
INSERT INTO admins (username, password_hash, role) VALUES 
('admin', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Insert sample artists
INSERT INTO artists (name, slug, description, image_url) VALUES
('REIRIE', 'reirie', 'REIRIEのアーティストページ', 'https://via.placeholder.com/400x400'),
('みことね', 'mikotone', 'みことねのアーティストページ', 'https://via.placeholder.com/400x400')
ON CONFLICT (slug) DO NOTHING;

-- Insert sample events
INSERT INTO events (artist_id, title, slug, description, thumbnail_url, event_type, stream_url, start_time, end_time, status) VALUES
(1, 'REIRIE LIVE 2026 - さいたま', 'reirie-2026-saitama-vj3', 'REIRIE LIVE 2026 さいたま公演', 'https://via.placeholder.com/800x450', 'live', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', '2026-02-15 17:00:00+09', '2026-02-15 19:00:00+09', 'live')
ON CONFLICT (slug) DO NOTHING;

-- Insert sample tickets
INSERT INTO tickets (event_id, name, description, price, currency, stock, is_active) VALUES
(1, '一般チケット', 'REIRIE LIVE 2026 一般チケット', 3000.00, 'JPY', NULL, TRUE)
ON CONFLICT DO NOTHING;
```

---

### フェーズ3: EC2インスタンス作成・セットアップ（1-2日）

#### 3.1 EC2インスタンス起動

```bash
# キーペア作成（SSH接続用）
aws ec2 create-key-pair \
  --key-name streaming-platform-key \
  --query 'KeyMaterial' \
  --output text > ~/.ssh/streaming-platform-key.pem

chmod 400 ~/.ssh/streaming-platform-key.pem

# EC2インスタンス起動
aws ec2 run-instances \
  --image-id ami-0d52744d6551d851e \
  --instance-type t3.small \
  --key-name streaming-platform-key \
  --security-group-ids $EC2_SG_ID \
  --subnet-id subnet-xxxxx \
  --associate-public-ip-address \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=streaming-platform-server}]' \
  --block-device-mappings 'DeviceName=/dev/xvda,Ebs={VolumeSize=30,VolumeType=gp3}' \
  --region ap-northeast-1

# インスタンスIDとパブリックIP取得
INSTANCE_ID="i-xxxxxxxxx"
PUBLIC_IP=$(aws ec2 describe-instances \
  --instance-ids $INSTANCE_ID \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

echo "EC2 Public IP: $PUBLIC_IP"
```

#### 3.2 EC2インスタンスへのSSH接続・初期設定

```bash
# SSH接続
ssh -i ~/.ssh/streaming-platform-key.pem ubuntu@$PUBLIC_IP

# 以下、EC2インスタンス内での作業
```

**システム更新・基本パッケージインストール:**

```bash
# システム更新
sudo apt update && sudo apt upgrade -y

# 必要なパッケージインストール
sudo apt install -y \
  build-essential \
  curl \
  git \
  nginx \
  postgresql-client \
  certbot \
  python3-certbot-nginx

# Node.js 20.x インストール
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PM2インストール（プロセス管理）
sudo npm install -g pm2

# 確認
node --version  # v20.x.x
npm --version   # 10.x.x
pm2 --version   # 5.x.x
```

#### 3.3 アプリケーション用ユーザー作成

```bash
# アプリケーション用ユーザー作成
sudo adduser --disabled-password --gecos "" webapp
sudo usermod -aG sudo webapp

# webappユーザーに切り替え
sudo su - webapp
```

---

### フェーズ4: アプリケーション移行・デプロイ（2-3日）

#### 4.1 プロジェクトのクローン・セットアップ

```bash
# webappユーザーとして作業
cd /home/webapp

# GitHubからクローン（または直接ファイル転送）
git clone https://github.com/yotamatsumaru/dreamvison.git
cd dreamvison

# または、ローカルからrsyncで転送
# ローカルマシンで実行:
# rsync -avz -e "ssh -i ~/.ssh/streaming-platform-key.pem" \
#   --exclude 'node_modules' \
#   --exclude '.git' \
#   /home/user/webapp/ ubuntu@$PUBLIC_IP:/home/webapp/streaming-platform/
```

#### 4.2 プロジェクト構造の変更

**新しいディレクトリ構造:**

```
streaming-platform/
├── src/
│   ├── server.ts                # Express server entry point
│   ├── config/
│   │   └── database.ts          # PostgreSQL connection
│   ├── models/
│   │   ├── Artist.ts
│   │   ├── Event.ts
│   │   ├── Ticket.ts
│   │   └── Purchase.ts
│   ├── routes/
│   │   ├── stripe.routes.ts
│   │   ├── events.routes.ts
│   │   ├── artists.routes.ts
│   │   ├── watch.routes.ts
│   │   └── admin.routes.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   └── errorHandler.ts
│   └── utils/
│       ├── jwt.ts
│       └── cloudfront.ts
├── public/
│   ├── index.html
│   ├── events.html
│   ├── artists.html
│   └── static/
│       ├── app.js
│       ├── events.js
│       └── styles.css
├── db/
│   ├── schema.sql
│   └── seed.sql
├── ecosystem.config.js          # PM2 configuration
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

#### 4.3 必要なパッケージのインストール

**package.json更新:**

```json
{
  "name": "streaming-platform",
  "version": "1.0.0",
  "description": "Live streaming platform with EC2 and PostgreSQL",
  "main": "dist/server.js",
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "migrate": "psql $DATABASE_URL -f db/schema.sql",
    "seed": "psql $DATABASE_URL -f db/seed.sql",
    "pm2:start": "pm2 start ecosystem.config.js",
    "pm2:stop": "pm2 stop streaming-platform",
    "pm2:restart": "pm2 restart streaming-platform",
    "pm2:logs": "pm2 logs streaming-platform"
  },
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "dotenv": "^16.3.1",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "compression": "^1.7.4",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "stripe": "^14.10.0",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.0",
    "@types/pg": "^8.10.9",
    "@types/cors": "^2.8.17",
    "@types/compression": "^1.7.5",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/bcryptjs": "^2.4.6",
    "typescript": "^5.3.3",
    "ts-node-dev": "^2.0.0"
  }
}
```

```bash
# 依存関係インストール
npm install
```

#### 4.4 PostgreSQL接続設定

**src/config/database.ts:**

```typescript
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: {
    rejectUnauthorized: false  // RDS使用時
  }
});

// 接続テスト
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ PostgreSQL connection failed:', err);
    process.exit(1);
  } else {
    console.log('✅ PostgreSQL connected successfully');
    console.log('Server time:', res.rows[0].now);
  }
});

export default pool;
```

#### 4.5 Express サーバー構築

**src/server.ts:**

```typescript
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import dotenv from 'dotenv';

// Database connection
import './config/database';

// Routes
import stripeRoutes from './routes/stripe.routes';
import eventsRoutes from './routes/events.routes';
import artistsRoutes from './routes/artists.routes';
import watchRoutes from './routes/watch.routes';
import adminRoutes from './routes/admin.routes';

// Middleware
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,  // フロントエンドで調整
  crossOriginEmbedderPolicy: false
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Static files
app.use('/static', express.static(path.join(__dirname, '../public/static')));
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/stripe', stripeRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/artists', artistsRoutes);
app.use('/api/watch', watchRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// HTML Routes
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/events', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/events.html'));
});

app.get('/events/:slug', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/event-detail.html'));
});

app.get('/artists', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/artists.html'));
});

app.get('/artists/:slug', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/artist-detail.html'));
});

app.get('/watch/:slug', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/watch.html'));
});

app.get('/admin', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

app.get('/success', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/success.html'));
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️  Database: ${process.env.DB_HOST}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});
```

#### 4.6 環境変数設定

**.env ファイル作成:**

```bash
# .env
NODE_ENV=production
PORT=3000

# Database
DB_HOST=streaming-platform-db.xxxxxx.ap-northeast-1.rds.amazonaws.com
DB_PORT=5432
DB_USER=dbadmin
DB_PASSWORD=YourStrongPassword123!
DB_NAME=streaming_platform

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_live_...

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this

# Admin
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# CORS
CORS_ORIGIN=https://yourdomain.com

# CloudFront (optional)
CLOUDFRONT_KEY_PAIR_ID=your-key-pair-id
CLOUDFRONT_PRIVATE_KEY_PATH=/path/to/private-key.pem
```

**セキュリティ強化:**
```bash
chmod 600 .env
```

#### 4.7 データベースマイグレーション

```bash
# 環境変数をロード
export $(cat .env | xargs)

# PostgreSQLに接続してスキーマ作成
PGPASSWORD=$DB_PASSWORD psql \
  -h $DB_HOST \
  -U $DB_USER \
  -d $DB_NAME \
  -f db/schema.sql

# シードデータ投入
PGPASSWORD=$DB_PASSWORD psql \
  -h $DB_HOST \
  -U $DB_USER \
  -d $DB_NAME \
  -f db/seed.sql

# 確認
PGPASSWORD=$DB_PASSWORD psql \
  -h $DB_HOST \
  -U $DB_USER \
  -d $DB_NAME \
  -c "SELECT * FROM artists;"
```

#### 4.8 TypeScriptビルド

```bash
# TypeScriptコンパイル
npm run build

# 出力確認
ls -la dist/
```

#### 4.9 PM2設定・起動

**ecosystem.config.js:**

```javascript
module.exports = {
  apps: [{
    name: 'streaming-platform',
    script: './dist/server.js',
    instances: 2,  // CPUコア数に応じて調整
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env_production: {
      NODE_ENV: 'production'
    }
  }]
};
```

**PM2起動:**

```bash
# ログディレクトリ作成
mkdir -p logs

# PM2でアプリ起動
pm2 start ecosystem.config.js --env production

# 起動確認
pm2 list
pm2 logs streaming-platform --lines 50

# システム起動時に自動起動
pm2 startup
pm2 save

# PM2管理コマンド
pm2 restart streaming-platform
pm2 stop streaming-platform
pm2 delete streaming-platform
```

---

### フェーズ5: Nginx設定・SSL証明書（1日）

#### 5.1 Nginx設定

**/etc/nginx/sites-available/streaming-platform:**

```nginx
upstream streaming_backend {
    server 127.0.0.1:3000;
    keepalive 64;
}

# HTTP server (redirect to HTTPS)
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;

    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirect to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL証明書（Let's Encrypt）
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/yourdomain.com/chain.pem;

    # SSL設定
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logging
    access_log /var/log/nginx/streaming-platform-access.log;
    error_log /var/log/nginx/streaming-platform-error.log;

    # Root directory
    root /home/webapp/streaming-platform/public;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;

    # Static files
    location /static/ {
        alias /home/webapp/streaming-platform/public/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API proxy
    location /api/ {
        proxy_pass http://streaming_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 90;
    }

    # HTML pages
    location / {
        try_files $uri $uri/ @backend;
    }

    location @backend {
        proxy_pass http://streaming_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Security: deny access to hidden files
    location ~ /\. {
        deny all;
    }
}
```

**Nginx設定有効化:**

```bash
# シンボリックリンク作成
sudo ln -s /etc/nginx/sites-available/streaming-platform /etc/nginx/sites-enabled/

# デフォルト設定削除
sudo rm /etc/nginx/sites-enabled/default

# 設定テスト
sudo nginx -t

# Nginx起動
sudo systemctl restart nginx
sudo systemctl enable nginx
```

#### 5.2 SSL証明書取得（Let's Encrypt）

```bash
# Certbotでドメイン検証・証明書取得
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# 質問に回答:
# Email address: your@email.com
# Terms of Service: Agree
# Share email: No
# Redirect HTTP to HTTPS: Yes

# 自動更新設定確認
sudo systemctl status certbot.timer

# 手動更新テスト
sudo certbot renew --dry-run
```

---

### フェーズ6: 動作確認・最終調整（1日）

#### 6.1 動作確認

```bash
# ローカルテスト
curl http://localhost:3000/api/health

# 外部からテスト
curl https://yourdomain.com/api/health

# データベース接続確認
curl https://yourdomain.com/api/artists
curl https://yourdomain.com/api/events
```

#### 6.2 ログ監視

```bash
# Nginxログ
sudo tail -f /var/log/nginx/streaming-platform-access.log
sudo tail -f /var/log/nginx/streaming-platform-error.log

# PM2ログ
pm2 logs streaming-platform

# PostgreSQLログ
# RDSコンソールで確認
```

---

## 📊 コスト見積もり（月額）

| リソース | スペック | 月額費用（USD） | 月額費用（JPY）|
|---|---|---|---|
| EC2 (t3.small) | 2 vCPU, 2GB RAM | $15 | ¥2,250 |
| RDS PostgreSQL (db.t3.micro) | 1 vCPU, 1GB RAM | $14 | ¥2,100 |
| EBS (30GB gp3) | SSD | $3 | ¥450 |
| データ転送 (100GB/月) | | $9 | ¥1,350 |
| Elastic IP | 固定IP | $3.6 | ¥540 |
| **合計** | | **$44.6** | **¥6,690** |

※為替レート: 1 USD = 150 JPY

---

## 🔒 セキュリティ対策

### 必須対策

1. **SSH キー認証のみ許可**
```bash
sudo nano /etc/ssh/sshd_config
# PasswordAuthentication no
sudo systemctl restart sshd
```

2. **ファイアウォール設定（UFW）**
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

3. **Fail2Ban（ブルートフォース攻撃防止）**
```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

4. **自動セキュリティアップデート**
```bash
sudo apt install unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

5. **RDS暗号化**
- 作成時に `--storage-encrypted` を指定済み

6. **環境変数の保護**
```bash
chmod 600 /home/webapp/streaming-platform/.env
```

---

## 🔄 バックアップ戦略

### RDS自動バックアップ

```bash
# バックアップ設定確認
aws rds describe-db-instances \
  --db-instance-identifier streaming-platform-db \
  --query 'DBInstances[0].{BackupRetention:BackupRetentionPeriod,Window:PreferredBackupWindow}'

# 手動スナップショット作成
aws rds create-db-snapshot \
  --db-instance-identifier streaming-platform-db \
  --db-snapshot-identifier streaming-platform-manual-$(date +%Y%m%d-%H%M%S)
```

### EC2スナップショット（AMI）

```bash
# AMI作成
aws ec2 create-image \
  --instance-id $INSTANCE_ID \
  --name "streaming-platform-backup-$(date +%Y%m%d)" \
  --description "Streaming platform backup" \
  --no-reboot
```

---

## 📝 デプロイ・更新手順

### コード更新のデプロイ

```bash
# EC2にSSH接続
ssh -i ~/.ssh/streaming-platform-key.pem ubuntu@$PUBLIC_IP
sudo su - webapp
cd /home/webapp/streaming-platform

# 最新コードを取得
git pull origin main

# 依存関係更新
npm install

# ビルド
npm run build

# PM2再起動
pm2 restart streaming-platform

# ログ確認
pm2 logs streaming-platform --lines 50
```

---

## 🚀 次のステップ

移行が完了したら:

1. ✅ ドメイン設定（Route 53）
2. ✅ CloudFront CDN追加（オプション）
3. ✅ 監視・アラート設定（CloudWatch）
4. ✅ CI/CD パイプライン構築（GitHub Actions）
5. ✅ 負荷テスト実施

---

## 💡 トラブルシューティング

### よくある問題

**1. RDS接続エラー**
```bash
# セキュリティグループ確認
aws ec2 describe-security-groups --group-ids $RDS_SG_ID

# EC2からRDS接続テスト
psql -h $DB_HOST -U $DB_USER -d $DB_NAME
```

**2. PM2プロセスが起動しない**
```bash
pm2 logs streaming-platform --err
# .envファイルの確認
cat .env
```

**3. Nginx 502 Bad Gateway**
```bash
# Express起動確認
curl http://localhost:3000/api/health
# Nginx設定確認
sudo nginx -t
# ログ確認
sudo tail -f /var/log/nginx/streaming-platform-error.log
```

---

準備ができたら具体的な移行作業を始めましょう！質問があればいつでもお知らせください。
