# 🚀 AWS EC2 + PostgreSQL デプロイ - クイックスタートガイド

## 前提条件

- AWSアカウント
- GitHubリポジトリへのアクセス
- ドメイン名 (オプション)
- Stripe APIキー

---

## 📋 デプロイ手順 (30分)

### Step 1: RDS PostgreSQL 作成 (10分)

1. AWS Management Console → RDS
2. **Create database**
   - Engine: `PostgreSQL 15.x`
   - Template: `Free tier` または `Production`
   - DB instance identifier: `streaming-platform-db`
   - Master username: `postgres`
   - Master password: `強力なパスワード設定`
   - DB instance class: `db.t3.micro` (開発) / `db.t3.small` (本番)
   - Storage: `20 GB` (最小)
   - VPC: デフォルト
   - Public access: `No`
   - Database name: `streaming_platform`

3. **エンドポイントをコピー**:
   ```
   streaming-platform-db.xxxxxxxxxxxx.ap-northeast-1.rds.amazonaws.com
   ```

### Step 2: EC2 インスタンス作成 (5分)

1. AWS Management Console → EC2
2. **Launch Instance**
   - Name: `streaming-platform-web`
   - AMI: `Ubuntu 22.04 LTS`
   - Instance type: `t3.micro` (開発) / `t3.small` (本番)
   - Key pair: 新規作成または既存選択
   - Security group: 
     - SSH (22) - My IP
     - HTTP (80) - 0.0.0.0/0
     - HTTPS (443) - 0.0.0.0/0

3. **Elastic IP 割り当て** (推奨):
   - EC2 Console → Elastic IPs → Allocate
   - インスタンスに関連付け

### Step 3: セキュリティグループ設定 (3分)

1. RDSのセキュリティグループ編集
2. **Inbound rules** に追加:
   - Type: `PostgreSQL`
   - Port: `5432`
   - Source: EC2のセキュリティグループ

### Step 4: EC2へデプロイ (10分)

```bash
# 1. SSH接続
ssh -i your-key.pem ubuntu@<EC2のIP>

# 2. デプロイスクリプトのダウンロード
wget https://raw.githubusercontent.com/yourusername/streaming-platform/main/deploy-ec2.sh
chmod +x deploy-ec2.sh

# 3. デプロイ実行
./deploy-ec2.sh

# 4. 環境変数設定
sudo nano /home/ubuntu/webapp/.env
```

**.env 設定内容**:
```bash
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@streaming-platform-db.xxxxxxxxxxxx.ap-northeast-1.rds.amazonaws.com:5432/streaming_platform
STRIPE_SECRET_KEY=sk_live_your_stripe_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
JWT_SECRET=$(openssl rand -base64 32)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password
PORT=3000
NODE_ENV=production
```

```bash
# 5. データベースマイグレーション
cd /home/ubuntu/webapp
npm run db:migrate
npm run db:seed  # オプション

# 6. アプリケーション起動
pm2 restart streaming-platform
pm2 logs streaming-platform --nostream

# 7. 動作確認
curl http://localhost:3000/api/health
```

### Step 5: ドメイン設定とSSL (5分)

```bash
# 1. DNSレコード設定 (ドメインプロバイダー)
A    @      <EC2のElastic IP>    3600
A    www    <EC2のElastic IP>    3600

# 2. Nginx設定更新
sudo nano /etc/nginx/sites-available/streaming-platform
# server_name を実際のドメインに変更

# 3. SSL証明書取得
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# 4. Nginx再起動
sudo nginx -t
sudo systemctl reload nginx
```

---

## ✅ 完了確認

1. **HTTPSアクセス**: `https://yourdomain.com`
2. **Health Check**: `https://yourdomain.com/api/health`
3. **イベント一覧**: `https://yourdomain.com/events`
4. **管理画面**: `https://yourdomain.com/admin`

---

## 🛠️ 管理コマンド

### アプリケーション管理

```bash
# ログ確認
pm2 logs streaming-platform --lines 100

# 再起動
pm2 restart streaming-platform

# ステータス確認
pm2 status

# 停止
pm2 stop streaming-platform
```

### データベース管理

```bash
# コンソール接続
npm run db:console

# マイグレーション
npm run db:migrate

# バックアップ (手動)
pg_dump "$DATABASE_URL" > backup_$(date +%Y%m%d).sql
```

### Nginx管理

```bash
# ログ確認
sudo tail -f /var/log/nginx/streaming-platform-access.log
sudo tail -f /var/log/nginx/streaming-platform-error.log

# 設定テスト
sudo nginx -t

# リロード
sudo systemctl reload nginx
```

---

## 📊 監視 (CloudWatch)

### アラーム設定例

1. **EC2 CPU使用率** > 80%
2. **RDS CPU使用率** > 80%
3. **RDS 接続数** > 80
4. **EC2 ステータスチェック** 失敗

---

## 💰 コスト管理

### 月額コスト見積もり

#### 開発環境 (無料枠内)
- EC2 t3.micro: $0 (12ヶ月間)
- RDS db.t3.micro: $0 (12ヶ月間)
- Elastic IP: $0 (使用中)

**合計**: $0/月 (1年目)

#### 本番環境
- EC2 t3.small: $17/月
- RDS db.t3.small: $30/月
- Elastic IP: $0 (使用中)
- データ転送: 従量課金

**合計**: 約 $50-70/月

---

## 🆘 トラブルシューティング

### アプリケーションが起動しない

```bash
# ログ確認
pm2 logs streaming-platform --lines 50

# 環境変数確認
cat /home/ubuntu/webapp/.env

# ポート確認
sudo netstat -tulpn | grep 3000
```

### データベース接続エラー

```bash
# RDSエンドポイント確認
# AWS Console → RDS → Databases

# セキュリティグループ確認
# RDSのセキュリティグループがEC2からのポート5432を許可しているか

# 接続テスト
psql "$DATABASE_URL" -c "SELECT version();"
```

### Nginx 502 Bad Gateway

```bash
# アプリケーションステータス
pm2 status

# ローカル接続テスト
curl http://localhost:3000/api/health

# Nginxエラーログ
sudo tail -f /var/log/nginx/error.log
```

---

## 📚 詳細ドキュメント

- **[AWS_DEPLOYMENT.md](./AWS_DEPLOYMENT.md)**: 包括的なデプロイ手順
- **[AWS_MIGRATION_SUMMARY.md](./AWS_MIGRATION_SUMMARY.md)**: 移行内容まとめ
- **[README.md](./README.md)**: プロジェクト概要

---

## 🎉 完了!

デプロイが完了したら、以下を確認してください:

1. ✅ HTTPSアクセス可能
2. ✅ データベース接続正常
3. ✅ 管理画面ログイン可能
4. ✅ Stripe決済テスト成功
5. ✅ CloudWatch監視設定完了

---

**最終更新**: 2026-02-21
