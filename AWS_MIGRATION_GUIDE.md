# AWS + MySQL 移行ガイド

## 🎯 移行概要

現在の構成:
- **ホスティング**: Cloudflare Pages
- **データベース**: Cloudflare D1 (SQLite)
- **フレームワーク**: Hono + TypeScript

移行後の構成:
- **ホスティング**: AWS Amplify または EC2
- **データベース**: Amazon RDS MySQL
- **フレームワーク**: Express.js + TypeScript（Honoから移行）

---

## 📊 移行の必要な変更点

### 1. データベース層の変更
- **D1 (SQLite) → RDS MySQL**
- SQL文の互換性確認（主にAUTO_INCREMENTなど）
- 接続方法の変更（mysql2パッケージ使用）

### 2. アプリケーション層の変更
- **Hono → Express.js**（Node.js環境で動作）
- Cloudflare Workers専用機能の削除
- 環境変数の管理方法変更

### 3. インフラ層の変更
- **Wrangler → AWS CLI / Amplify CLI**
- 静的ファイルの配信方法変更

---

## 🚀 移行手順（AWS Amplify + RDS MySQL）

### フェーズ1: 準備（1-2日）

#### 1.1 AWSアカウント準備
```bash
# AWS CLIのインストール
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# AWS認証情報の設定
aws configure
# AWS Access Key ID: [入力]
# AWS Secret Access Key: [入力]
# Default region name: ap-northeast-1 (東京リージョン)
# Default output format: json
```

#### 1.2 必要なAWSサービスの確認
- ✅ Amazon RDS（MySQL）
- ✅ AWS Amplify（フロントエンド・バックエンド）
- ✅ Amazon S3（静的ファイル・動画配信）
- ✅ Amazon CloudFront（CDN）
- ✅ AWS Secrets Manager（認証情報管理）

---

### フェーズ2: データベース移行（2-3日）

#### 2.1 RDS MySQLインスタンスの作成

**AWSコンソールでの作成:**
1. RDSダッシュボードを開く
2. 「データベースの作成」をクリック
3. 設定:
   - **エンジンタイプ**: MySQL 8.0
   - **テンプレート**: 開発/テスト（または本番用）
   - **DB インスタンスサイズ**: db.t3.micro（無料枠）または db.t3.small
   - **ストレージ**: 20 GB（SSD）
   - **マルチAZ配置**: 本番環境では有効化推奨
   - **データベース名**: `streaming_platform`
   - **マスターユーザー名**: `admin`
   - **マスターパスワード**: [強力なパスワードを設定]
   - **パブリックアクセス**: はい（開発時のみ、本番は「いいえ」）
   - **VPCセキュリティグループ**: 新規作成
   - **初期データベース名**: `streaming_platform`

**AWS CLIでの作成:**
```bash
aws rds create-db-instance \
  --db-instance-identifier streaming-platform-db \
  --db-instance-class db.t3.micro \
  --engine mysql \
  --engine-version 8.0 \
  --master-username admin \
  --master-user-password [YOUR_PASSWORD] \
  --allocated-storage 20 \
  --storage-type gp2 \
  --vpc-security-group-ids [YOUR_SECURITY_GROUP] \
  --db-name streaming_platform \
  --publicly-accessible \
  --region ap-northeast-1
```

#### 2.2 D1からMySQLへのスキーマ移行

**現在のD1スキーマ（SQLite）:**
```sql
-- migrations/0001_initial_schema.sql
CREATE TABLE IF NOT EXISTS artists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  image_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  artist_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  event_type TEXT NOT NULL CHECK(event_type IN ('live', 'archive')),
  stream_url TEXT,
  archive_url TEXT,
  cloudfront_key_pair_id TEXT,
  start_time DATETIME,
  end_time DATETIME,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK(status IN ('upcoming', 'live', 'ended', 'archived')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
);

-- 他のテーブル: tickets, purchases, admins
```

**MySQL対応スキーマ:**
```sql
-- mysql/schema.sql
CREATE TABLE IF NOT EXISTS artists (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  image_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  artist_id INT NOT NULL,
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  thumbnail_url VARCHAR(500),
  event_type ENUM('live', 'archive') NOT NULL,
  stream_url VARCHAR(500),
  archive_url VARCHAR(500),
  cloudfront_key_pair_id VARCHAR(100),
  start_time TIMESTAMP NULL,
  end_time TIMESTAMP NULL,
  status ENUM('upcoming', 'live', 'ended', 'archived') NOT NULL DEFAULT 'upcoming',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE,
  INDEX idx_slug (slug),
  INDEX idx_status (status),
  INDEX idx_start_time (start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tickets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'JPY',
  stripe_product_id VARCHAR(255),
  stripe_price_id VARCHAR(255),
  stock INT,
  sold_count INT DEFAULT 0,
  sale_start TIMESTAMP NULL,
  sale_end TIMESTAMP NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  INDEX idx_event_id (event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  ticket_id INT NOT NULL,
  stripe_customer_id VARCHAR(255),
  stripe_checkout_session_id VARCHAR(255) UNIQUE,
  stripe_payment_intent_id VARCHAR(255),
  customer_email VARCHAR(255) NOT NULL,
  customer_name VARCHAR(255),
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'JPY',
  status ENUM('pending', 'completed', 'refunded', 'failed') NOT NULL DEFAULT 'pending',
  access_token TEXT,
  access_expires_at TIMESTAMP NULL,
  purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  INDEX idx_stripe_session (stripe_checkout_session_id),
  INDEX idx_customer_email (customer_email),
  INDEX idx_access_token (access_token(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**主な変更点:**
- `INTEGER` → `INT`
- `TEXT` → `VARCHAR` または `TEXT`
- `AUTOINCREMENT` → `AUTO_INCREMENT`
- `DATETIME` → `TIMESTAMP`
- `CHECK` 制約 → `ENUM` 型
- `utf8mb4` 文字セット指定（絵文字対応）
- インデックスの追加

#### 2.3 データベース接続の設定

**package.jsonに依存関係追加:**
```bash
npm install mysql2 dotenv
npm install --save-dev @types/mysql2
```

**環境変数の設定（.env）:**
```env
# Database
DB_HOST=your-rds-endpoint.ap-northeast-1.rds.amazonaws.com
DB_PORT=3306
DB_USER=admin
DB_PASSWORD=your-strong-password
DB_NAME=streaming_platform

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# JWT
JWT_SECRET=your-jwt-secret-key

# Admin
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

---

### フェーズ3: アプリケーション移行（3-5日）

#### 3.1 Hono → Express.js への移行

**現在の構造:**
```
src/
├── index.tsx (Hono app)
├── routes/
│   ├── stripe.ts
│   ├── events.ts
│   ├── artists.ts
│   ├── watch.ts
│   └── admin.ts
└── lib/
    └── db.ts (D1 wrapper)
```

**新しい構造:**
```
src/
├── server.ts (Express app)
├── routes/
│   ├── stripe.routes.ts
│   ├── events.routes.ts
│   ├── artists.routes.ts
│   ├── watch.routes.ts
│   └── admin.routes.ts
├── models/
│   ├── db.ts (MySQL connection)
│   ├── Artist.ts
│   ├── Event.ts
│   ├── Ticket.ts
│   └── Purchase.ts
├── middleware/
│   ├── auth.ts
│   └── errorHandler.ts
└── config/
    └── database.ts
```

**MySQL接続プール設定（src/config/database.ts）:**
```typescript
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// 接続テスト
pool.getConnection()
  .then(connection => {
    console.log('✅ MySQL connected successfully');
    connection.release();
  })
  .catch(err => {
    console.error('❌ MySQL connection failed:', err);
    process.exit(1);
  });
```

**Express サーバーの設定（src/server.ts）:**
```typescript
import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

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

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// HTML Routes (serve static HTML or use template engine)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/events', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/events.html'));
});

// ... other routes

// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
```

**データベースモデルの例（src/models/Event.ts）:**
```typescript
import { pool } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface Event {
  id: number;
  artist_id: number;
  title: string;
  slug: string;
  description?: string;
  thumbnail_url?: string;
  event_type: 'live' | 'archive';
  stream_url?: string;
  archive_url?: string;
  start_time?: Date;
  end_time?: Date;
  status: 'upcoming' | 'live' | 'ended' | 'archived';
  created_at: Date;
  updated_at: Date;
}

export class EventModel {
  static async getAll(filters?: {
    artistId?: number;
    status?: string;
  }): Promise<Event[]> {
    let query = 'SELECT * FROM events WHERE 1=1';
    const params: any[] = [];

    if (filters?.artistId) {
      query += ' AND artist_id = ?';
      params.push(filters.artistId);
    }

    if (filters?.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY start_time ASC';

    const [rows] = await pool.execute<RowDataPacket[]>(query, params);
    return rows as Event[];
  }

  static async getBySlug(slug: string): Promise<Event | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM events WHERE slug = ?',
      [slug]
    );
    return rows.length > 0 ? (rows[0] as Event) : null;
  }

  static async create(event: Omit<Event, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO events (artist_id, title, slug, description, thumbnail_url, 
       event_type, stream_url, archive_url, start_time, end_time, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.artist_id,
        event.title,
        event.slug,
        event.description,
        event.thumbnail_url,
        event.event_type,
        event.stream_url,
        event.archive_url,
        event.start_time,
        event.end_time,
        event.status
      ]
    );
    return result.insertId;
  }

  static async update(id: number, updates: Partial<Event>): Promise<boolean> {
    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) return false;

    values.push(id);
    await pool.execute(
      `UPDATE events SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    return true;
  }

  static async delete(id: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM events WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  }
}
```

#### 3.2 ルートの移行例（src/routes/events.routes.ts）

```typescript
import express from 'express';
import { EventModel } from '../models/Event';
import { TicketModel } from '../models/Ticket';

const router = express.Router();

// Get all events
router.get('/', async (req, res, next) => {
  try {
    const { artist, status } = req.query;
    
    const filters: any = {};
    if (artist) filters.artistId = parseInt(artist as string);
    if (status) filters.status = status as string;
    
    const events = await EventModel.getAll(filters);
    
    // Sort: live first, then upcoming, then by start_time
    events.sort((a, b) => {
      if (a.status === 'live' && b.status !== 'live') return -1;
      if (a.status !== 'live' && b.status === 'live') return 1;
      if (a.status === 'upcoming' && b.status !== 'upcoming') return -1;
      if (a.status !== 'upcoming' && b.status === 'upcoming') return 1;
      if (a.start_time && b.start_time) {
        return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
      }
      return 0;
    });
    
    res.json(events);
  } catch (error) {
    next(error);
  }
});

// Get event by slug
router.get('/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const event = await EventModel.getBySlug(slug);
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Get tickets
    const tickets = await TicketModel.getByEventId(event.id);
    
    res.json({ ...event, tickets });
  } catch (error) {
    next(error);
  }
});

export default router;
```

---

### フェーズ4: AWS Amplifyへのデプロイ（1-2日）

#### 4.1 Amplify CLIのインストール

```bash
npm install -g @aws-amplify/cli
amplify configure
```

#### 4.2 Amplifyプロジェクトの初期化

```bash
cd /home/user/webapp
amplify init

# 質問に回答:
# ? Enter a name for the project: streaming-platform
# ? Initialize the project with the above configuration? No
# ? Enter a name for the environment: production
# ? Choose your default editor: Visual Studio Code
# ? Choose the type of app that you're building: javascript
# ? What javascript framework are you using: react (静的ファイルのため)
# ? Source Directory Path: public
# ? Distribution Directory Path: public
# ? Build Command: npm run build
# ? Start Command: npm start
# ? Select the authentication method: AWS profile
# ? Please choose the profile you want to use: default
```

#### 4.3 バックエンドAPIの追加

```bash
# Lambda関数とAPI Gatewayを作成
amplify add api

# 質問に回答:
# ? Select from one of the below mentioned services: REST
# ? Provide a friendly name for your resource: streamingapi
# ? Provide a path: /api
# ? Choose a Lambda source: Create a new Lambda function
# ? Provide an AWS Lambda function name: streamingPlatformAPI
# ? Choose the runtime: NodeJS
# ? Choose the function template: Serverless ExpressJS function
# ? Do you want to configure advanced settings? No
# ? Do you want to edit the local lambda function now? No
# ? Restrict API access? No
# ? Do you want to add another path? No
```

#### 4.4 環境変数の設定

```bash
amplify env add

# Secrets Managerに環境変数を保存
aws secretsmanager create-secret \
  --name /streaming-platform/production/env \
  --secret-string '{
    "DB_HOST": "your-rds-endpoint.rds.amazonaws.com",
    "DB_USER": "admin",
    "DB_PASSWORD": "your-password",
    "DB_NAME": "streaming_platform",
    "STRIPE_SECRET_KEY": "sk_live_...",
    "JWT_SECRET": "your-jwt-secret"
  }'
```

#### 4.5 デプロイ

```bash
# ビルド
npm run build

# Amplifyにデプロイ
amplify push

# ホスティングを追加
amplify add hosting

# 質問に回答:
# ? Select the plugin module to execute: Hosting with Amplify Console
# ? Choose a type: Manual deployment

# デプロイ実行
amplify publish
```

---

### フェーズ5: データ移行（1日）

#### 5.1 D1からデータをエクスポート

```bash
# 現在のD1データをSQLダンプ
cd /home/user/webapp
npx wrangler d1 execute streaming-platform-production --local --command="SELECT * FROM artists" > artists_export.json
npx wrangler d1 execute streaming-platform-production --local --command="SELECT * FROM events" > events_export.json
npx wrangler d1 execute streaming-platform-production --local --command="SELECT * FROM tickets" > tickets_export.json
```

#### 5.2 MySQLにデータをインポート

```bash
# MySQL接続
mysql -h your-rds-endpoint.rds.amazonaws.com -u admin -p streaming_platform

# データインポート（手動またはスクリプト）
```

**または Node.jsスクリプトで移行:**
```typescript
// scripts/migrate-data.ts
import { pool } from '../src/config/database';
import * as fs from 'fs';

async function migrateData() {
  try {
    // Read exported data
    const artists = JSON.parse(fs.readFileSync('artists_export.json', 'utf8'));
    const events = JSON.parse(fs.readFileSync('events_export.json', 'utf8'));
    
    // Insert artists
    for (const artist of artists) {
      await pool.execute(
        'INSERT INTO artists (name, slug, description, image_url) VALUES (?, ?, ?, ?)',
        [artist.name, artist.slug, artist.description, artist.image_url]
      );
    }
    
    // Insert events
    for (const event of events) {
      await pool.execute(
        `INSERT INTO events (artist_id, title, slug, description, thumbnail_url, 
         event_type, stream_url, start_time, end_time, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          event.artist_id, event.title, event.slug, event.description,
          event.thumbnail_url, event.event_type, event.stream_url,
          event.start_time, event.end_time, event.status
        ]
      );
    }
    
    console.log('✅ Data migration completed');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await pool.end();
  }
}

migrateData();
```

```bash
npx ts-node scripts/migrate-data.ts
```

---

## 📊 コスト見積もり

### AWS月額コスト（概算）

| サービス | 構成 | 月額費用 |
|---|---|---|
| RDS MySQL | db.t3.micro (1GB RAM) | 無料枠内 or ¥2,000 |
| Amplify Hosting | 5GB転送/月 | 無料枠内 or ¥1,000 |
| Lambda | 100万リクエスト/月 | 無料枠内 |
| S3 | 5GB保存 + 転送 | ¥500 |
| CloudFront | 50GB転送/月 | ¥1,000 |
| **合計** | | **約 ¥4,500/月** |

※本番運用・トラフィック増加時は追加コストが発生

---

## ⚠️ 注意点とリスク

### 移行の課題

1. **互換性の問題**
   - SQLite → MySQL の構文差異
   - Cloudflare Workers → Node.js の環境差異
   - Hono → Express.js のAPI差異

2. **運用コスト**
   - Cloudflare: ほぼ無料
   - AWS: 月額 ¥4,500〜（トラフィックで変動）

3. **管理の複雑さ**
   - Cloudflare: マネージド（自動スケール）
   - AWS: セキュリティ・スケーリング・バックアップを自己管理

4. **パフォーマンス**
   - Cloudflare: エッジで高速
   - AWS: リージョン依存（日本リージョン推奨）

---

## 🔄 代替案: Cloudflare継続 + 外部MySQL

**もしAWS移行の理由が「MySQLを使いたい」だけなら:**

Cloudflareのまま、外部のMySQLサービスを利用する選択肢もあります：

### オプションA: PlanetScale（推奨）
- MySQL互換のサーバーレスDB
- Cloudflare Workersと相性良い
- 無料枠あり
- HTTPベースのクエリ（エッジから高速アクセス）

```typescript
// Cloudflare Workers + PlanetScale
import { Client } from '@planetscale/database';

const client = new Client({
  host: process.env.DATABASE_HOST,
  username: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
});

const results = await client.execute('SELECT * FROM events');
```

### オプションB: Neon
- PostgreSQL（MySQLではないが類似）
- サーバーレス
- Cloudflareと統合可能

---

## 📝 推奨される判断基準

### AWS移行を選ぶべき場合:
✅ EC2などでNode.jsサーバーをフルコントロールしたい
✅ 既にAWSエコシステムを使用している
✅ RDS以外のAWSサービス（SageMaker、Rekognitionなど）も使いたい
✅ 大規模トラフィックで詳細なスケーリング制御が必要

### Cloudflare継続を選ぶべき場合:
✅ 低コスト・低運用負荷を維持したい
✅ グローバルなエッジ配信を活用したい
✅ D1からPlanetScale/Neonへの移行で十分
✅ サーバーレスアーキテクチャを継続したい

---

## 🚀 次のステップ

どちらの方向で進めるか決定してください：

### パターン1: AWS完全移行
→ このガイドのフェーズ1から順に進める（2週間）

### パターン2: Cloudflare + 外部MySQL
→ PlanetScale/Neon統合（3-5日で完了）

### パターン3: ハイブリッド
→ フロントエンド: Cloudflare Pages
→ バックエンドAPI: AWS Lambda + RDS
→ 最も複雑だが柔軟性が高い

---

お手伝いできることがあればお知らせください！
