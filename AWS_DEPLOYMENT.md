# AWS EC2 + PostgreSQL デプロイ手順書

## 目次

1. [概要](#概要)
2. [AWS環境の準備](#aws環境の準備)
3. [RDS PostgreSQLセットアップ](#rds-postgresqlセットアップ)
4. [EC2インスタンスセットアップ](#ec2インスタンスセットアップ)
5. [アプリケーションデプロイ](#アプリケーションデプロイ)
6. [ドメイン設定とSSL](#ドメイン設定とssl)
7. [監視とバックアップ](#監視とバックアップ)
8. [トラブルシューティング](#トラブルシューティング)

---

## 概要

このドキュメントでは、ライブ配信・ストリーミングプラットフォームを **AWS EC2 + RDS PostgreSQL** 環境にデプロイする手順を説明します。

### アーキテクチャ

```
[User Browser]
      ↓
[Route 53 / Domain]
      ↓
[Elastic Load Balancer] (Optional)
      ↓
[EC2 Instance]
  ├── Nginx (Port 80/443)
  ├── PM2 + Node.js (Port 3000)
  └── Static Files (public/)
      ↓
[RDS PostgreSQL]
```

### 技術スタック

- **OS**: Ubuntu 22.04 LTS
- **Web Server**: Nginx
- **Application Server**: Node.js 20.x + Hono
- **Process Manager**: PM2
- **Database**: PostgreSQL 15.x (RDS)
- **SSL**: Let's Encrypt (Certbot)

---

## AWS環境の準備

### 1. AWS アカウント準備

1. AWS Management Console にログイン
2. リージョンを選択（推奨: `ap-northeast-1` 東京リージョン）

### 2. VPC とセキュリティグループの作成

#### VPC (オプション - デフォルトVPCを使用する場合はスキップ)

```bash
# デフォルトVPCを使用する場合は特に設定不要
```

#### セキュリティグループの作成

**EC2用セキュリティグループ (`streaming-platform-web`)**:

| Type | Protocol | Port | Source | Description |
|------|----------|------|--------|-------------|
| SSH | TCP | 22 | My IP / 0.0.0.0/0 | SSH接続 |
| HTTP | TCP | 80 | 0.0.0.0/0 | HTTP |
| HTTPS | TCP | 443 | 0.0.0.0/0 | HTTPS |

**RDS用セキュリティグループ (`streaming-platform-db`)**:

| Type | Protocol | Port | Source | Description |
|------|----------|------|--------|-------------|
| PostgreSQL | TCP | 5432 | streaming-platform-web | DB接続 |

---

## RDS PostgreSQLセットアップ

### 1. RDSインスタンスの作成

1. **AWS RDS Console** → **Create database**
2. **Engine options**:
   - Engine type: `PostgreSQL`
   - Version: `PostgreSQL 15.x`
3. **Templates**: `Free tier` (開発用) または `Production` (本番用)
4. **Settings**:
   - DB instance identifier: `streaming-platform-db`
   - Master username: `postgres`
   - Master password: `強力なパスワード` (保存しておく)
5. **Instance configuration**:
   - Free tier: `db.t3.micro`
   - Production: `db.t3.small` 以上
6. **Storage**:
   - Storage type: `General Purpose SSD (gp3)`
   - Allocated storage: `20 GB` (最小)
   - Enable storage autoscaling: ✅
7. **Connectivity**:
   - VPC: デフォルトVPC
   - Subnet group: デフォルト
   - Public access: `No` (EC2からのみアクセス)
   - VPC security group: `streaming-platform-db`
8. **Database authentication**: `Password authentication`
9. **Additional configuration**:
   - Initial database name: `streaming_platform`
   - Automated backups: 有効 (7日間保持)

### 2. データベースエンドポイントの確認

RDSインスタンス作成後、**Endpoint** をコピーします:

```
streaming-platform-db.xxxxxxxxxxxx.ap-northeast-1.rds.amazonaws.com
```

このエンドポイントは後で `.env` ファイルに設定します。

### 3. DATABASE_URLの構築

```bash
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@streaming-platform-db.xxxxxxxxxxxx.ap-northeast-1.rds.amazonaws.com:5432/streaming_platform
```

---

## EC2インスタンスセットアップ

### 1. EC2インスタンスの起動

1. **AWS EC2 Console** → **Launch Instance**
2. **Name**: `streaming-platform-web`
3. **Application and OS Images**:
   - AMI: `Ubuntu Server 22.04 LTS`
   - Architecture: `64-bit (x86)`
4. **Instance type**: 
   - 開発: `t3.micro` (Free tier eligible)
   - 本番: `t3.small` 以上
5. **Key pair**:
   - 新規作成または既存のキーペアを選択
   - キーペア名: `streaming-platform-key`
   - ダウンロードして安全に保管
6. **Network settings**:
   - VPC: デフォルトVPC
   - Auto-assign public IP: `Enable`
   - Security group: `streaming-platform-web`
7. **Storage**: `20 GiB` gp3
8. **Launch instance**

### 2. Elastic IP の割り当て (推奨)

1. **EC2 Console** → **Elastic IPs** → **Allocate Elastic IP address**
2. 作成したEIPをEC2インスタンスに関連付け

これにより、インスタンス再起動時もIPアドレスが変わらなくなります。

### 3. EC2への接続

```bash
# キーペアのパーミッション設定
chmod 400 streaming-platform-key.pem

# SSH接続
ssh -i streaming-platform-key.pem ubuntu@<EC2のパブリックIP>
```

---

## アプリケーションデプロイ

### 自動デプロイスクリプトの実行

リポジトリに含まれる `deploy-ec2.sh` を使用します:

```bash
# EC2インスタンスにSSH接続した状態で実行

# デプロイスクリプトのダウンロード
wget https://raw.githubusercontent.com/yourusername/streaming-platform/main/deploy-ec2.sh

# 実行権限付与
chmod +x deploy-ec2.sh

# デプロイ実行
./deploy-ec2.sh
```

### 環境変数の設定

デプロイ後、`.env` ファイルを編集します:

```bash
sudo nano /home/ubuntu/webapp/.env
```

以下の内容を設定:

```bash
# PostgreSQL Database Connection (RDSエンドポイントを使用)
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@streaming-platform-db.xxxxxxxxxxxx.ap-northeast-1.rds.amazonaws.com:5432/streaming_platform

# Stripe Configuration
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# JWT Secret (ランダムな文字列を生成)
JWT_SECRET=$(openssl rand -base64 32)

# Admin Credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_admin_password

# Server Configuration
PORT=3000
NODE_ENV=production
```

### データベースマイグレーション

```bash
cd /home/ubuntu/webapp
npm run db:migrate
npm run db:seed  # オプション: サンプルデータ投入
```

### アプリケーション起動

```bash
cd /home/ubuntu/webapp
pm2 restart streaming-platform
pm2 logs streaming-platform --nostream
```

### 動作確認

```bash
# ヘルスチェック
curl http://localhost:3000/api/health

# ブラウザから確認
http://<EC2のパブリックIP>
```

---

## ドメイン設定とSSL

### 1. ドメインの設定

#### Route 53を使用する場合:

1. **Route 53 Console** → **Hosted zones** → **Create hosted zone**
2. ドメイン名を入力 (例: `example.com`)
3. **Create record**:
   - Record name: `@` (ルートドメイン)
   - Record type: `A`
   - Value: `<EC2のElastic IP>`
   - TTL: `300`
4. `www` サブドメインも同様に追加

#### 外部DNSを使用する場合:

DNSプロバイダーのダッシュボードで:

```
A    @      <EC2のElastic IP>    3600
A    www    <EC2のElastic IP>    3600
```

### 2. Nginx設定の更新

```bash
sudo nano /etc/nginx/sites-available/streaming-platform
```

`server_name` を実際のドメインに変更:

```nginx
server_name example.com www.example.com;
```

### 3. Let's Encrypt SSL証明書の取得

```bash
# Certbotのインストール
sudo apt install -y certbot python3-certbot-nginx

# SSL証明書の取得
sudo certbot --nginx -d example.com -d www.example.com

# メールアドレス入力、規約同意、HTTPSリダイレクト設定
```

### 4. 自動更新の設定

Certbotは自動的に更新cronを設定しますが、確認:

```bash
sudo systemctl status certbot.timer
```

手動更新テスト:

```bash
sudo certbot renew --dry-run
```

### 5. Nginxの再起動

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 監視とバックアップ

### 1. CloudWatch メトリクス

**EC2インスタンス監視**:
- CPU使用率
- ネットワークトラフィック
- ディスク使用率

**RDSインスタンス監視**:
- CPU使用率
- データベース接続数
- ストレージ使用率

### 2. CloudWatch Alarms

#### CPU使用率アラーム:

```bash
# EC2のCPU使用率が80%を超えた場合にアラート
# AWS Console → CloudWatch → Alarms → Create alarm
```

### 3. RDS自動バックアップ

RDSは自動的に日次バックアップを実行します:
- バックアップ保持期間: 7日間 (設定可能)
- バックアップウィンドウ: 自動 (または指定時刻)

### 4. 手動スナップショット

重要な変更前に手動スナップショット作成:

```bash
# AWS RDS Console → Snapshots → Take snapshot
```

### 5. アプリケーションログ

```bash
# PM2ログ
pm2 logs streaming-platform

# Nginxログ
sudo tail -f /var/log/nginx/streaming-platform-access.log
sudo tail -f /var/log/nginx/streaming-platform-error.log
```

---

## トラブルシューティング

### 1. アプリケーションが起動しない

```bash
# PM2ステータス確認
pm2 status

# ログ確認
pm2 logs streaming-platform --lines 50

# 環境変数確認
cat /home/ubuntu/webapp/.env

# データベース接続テスト
psql "$DATABASE_URL" -c "SELECT version();"
```

### 2. データベース接続エラー

```bash
# セキュリティグループ確認
# EC2のセキュリティグループがRDSのセキュリティグループを許可しているか確認

# RDSエンドポイント確認
# AWS RDS Console → Databases → streaming-platform-db → Connectivity & security

# 接続テスト
telnet <RDS_ENDPOINT> 5432
```

### 3. Nginx 502 Bad Gateway

```bash
# アプリケーションが起動しているか確認
curl http://localhost:3000/api/health

# PM2プロセス確認
pm2 status

# Nginx設定テスト
sudo nginx -t

# Nginxエラーログ
sudo tail -f /var/log/nginx/error.log
```

### 4. SSL証明書エラー

```bash
# 証明書の有効期限確認
sudo certbot certificates

# 証明書の更新
sudo certbot renew

# Nginxリロード
sudo systemctl reload nginx
```

---

## まとめ

このドキュメントに従うことで、AWS EC2 + RDS PostgreSQL環境でストリーミングプラットフォームを安全かつ効率的にデプロイできます。

### 追加のリソース

- [AWS EC2 Documentation](https://docs.aws.amazon.com/ec2/)
- [AWS RDS PostgreSQL Documentation](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)

### サポート

問題が発生した場合は、以下を確認してください:
- CloudWatch Logs
- PM2 Logs
- Nginx Error Logs
- RDS Performance Insights
