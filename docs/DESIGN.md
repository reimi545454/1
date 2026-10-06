# 安否確認サービス 設計書（PHASE 1 案）

> ステータス：設計案（未承認）。実装は未着手。
> 【要公式確認】の付いた記述は、LINE公式ドキュメント（developers.line.biz）で未検証の項目。実装時に必ず確認すること。

## 1. 推奨技術構成

| 層 | 採用 | 理由 |
|---|---|---|
| 言語 | TypeScript | |
| Web/API | Next.js（App Router） | LIFF画面・Webhook・管理画面・cronを1アプリに集約 |
| ホスティング | Google Cloud Run（最小インスタンス0） | 無料枠が大きく商用可、HTTPS URLが自動発行 |
| DB | Supabase（PostgreSQL） | Postgresそのまま、無料枠あり |
| ORM | Drizzle ORM + postgres.js | 軽量・型安全、SQLマイグレーション |
| 定期実行 | Cloud Scheduler（毎分1ジョブ）→ `/api/cron/tick` | 無料枠（3ジョブ）内 |
| 管理画面認証 | 環境変数のID + bcryptハッシュ + 署名付きhttpOnly Cookie | 外部サービス不要 |
| バリデーション | zod | |
| テスト | Vitest（状態遷移の単体テスト）＋実機LINEでのE2E | |

代替案：Vercel は Hobby プランが非商用限定で cron も1日1回程度のため、本サービスでは Pro（月$20）が必要となり不採用。

### 定期処理の方針
時刻ちょうどにジョブを起動する方式は採らず、**毎分1本の tick が「期限を過ぎて未処理のもの」をDBから拾って処理する**。

- 09:00 にサーバーが停止していても、復帰後の最初の tick で送信される
- tick の重複実行は、行単位の条件付きUPDATE（claim）と一意制約で防ぐ
- Push送信には `X-Line-Retry-Key`（送信ごとに決まるUUID）を付け、再送時の重複をLINE側でも防ぐ【要公式確認：有効期間、409応答の仕様】
- 本番とテストの違いは期限時刻の計算だけで、処理ロジックは共通

## 2. システム構成図

```
 [利用者LINE]   [通知者LINE]
      │  ▲          ▲
 友だち追加/       │Push（通知）
 ボタン押下 │Push   │
      ▼  │          │
 ┌──────────── LINE Platform ─────────────┐
 │ Messaging API channel   LINE Login channel │ ←同一プロバイダー
 │ (Webhook / Push / Reply)  (LIFFアプリ)      │
 └──┬───────────▲───────────────┬──────────┘
    │Webhook     │Push/Reply      │LIFF画面（ブラウザ）
    ▼            │                ▼
 ┌────────── Cloud Run: Next.js ───────────┐
 │ /api/line/webhook   署名検証→postback/follow処理 │
 │ /liff/register      登録フォーム（idTokenのみ送信） │
 │ /api/register       IDトークンをサーバー側で検証→保存 │
 │ /api/cron/tick      初期化・1回目・2回目・最終判定・通知 │
 │ /admin/*            管理画面（Cookie認証）          │
 └───────────┬───────────────▲──────────────┘
             │SQL             │毎分 POST（Bearer CRON_SECRET）
             ▼                │
      [Supabase Postgres]  [Cloud Scheduler]
```

## 3. DB設計

要件の設計からの変更点：

- **LINEアカウント・利用者・通知者を別テーブルにし、紐づけは中間テーブルで管理する。** 1人の家族が複数の利用者の通知者になれる。紐づけは内部IDの外部キーで行い、`user_code` は登録時の入口としてだけ使う。
- **「実行回（run）」の概念を追加する。** テストモードで同じ日に何度でも検証でき、本番の日次データと混ざらない。

```sql
line_accounts      -- LINEユーザー単位（1 userId = 1行）
  id uuid PK, line_user_id text UNIQUE NOT NULL,
  is_friend bool, blocked_at timestamptz, created_at, updated_at

users              -- 利用者（安否確認を受ける本人）
  id uuid PK, line_account_id FK UNIQUE, user_code text UNIQUE NOT NULL,
  name, phone NOT NULL, active bool DEFAULT true, is_test bool,
  registered_at, created_at, updated_at

notifiers          -- 通知者
  id uuid PK, line_account_id FK UNIQUE, name, phone NULL,
  active bool, created_at, updated_at

user_notifiers     -- 紐づけ（1利用者あたり有効な通知者は最大3名）
  id PK, user_id FK, notifier_id FK, relationship text, active bool,
  created_at, UNIQUE(user_id, notifier_id)

check_runs         -- 実行回（本番は1日1件、テストは何件でも作れる）
  id PK, kind ('scheduled'|'test'), check_date date(JST),
  first_due_at, second_due_at, final_due_at timestamptz, created_at
  UNIQUE(check_date) WHERE kind='scheduled'   -- 部分一意インデックス

daily_checks       -- 利用者ごと・回ごとの状態（＝日別履歴。削除しない）
  id uuid PK, run_id FK, user_id FK, check_date,
  status ('pending'|'answered'|'notifying'|'notified'|'no_notifier'|'notify_failed'|'skipped'),
  first_claimed_at, first_sent_at, second_claimed_at, second_sent_at,
  answered_at, final_judged_at, notification_sent_at,
  created_at, updated_at, UNIQUE(run_id, user_id)

notification_logs  -- 通知者ごとの送信結果
  id PK, daily_check_id FK, notifier_id FK, status ('sending'|'sent'|'failed'),
  line_request_id, http_status, error_message, sent_at, created_at,
  UNIQUE(daily_check_id, notifier_id)       -- 同じ日の重複通知を防ぐ

message_logs       -- LINEへ送った全メッセージ（月間送信数の集計用）
  id PK, line_account_id FK, kind ('first'|'second'|'notify'|'registered'|'reply'…),
  api ('push'|'reply'), daily_check_id NULL, retry_key uuid UNIQUE NULL,
  status, http_status, line_request_id, error_message, created_at

webhook_events     -- Webhookの重複受信対策
  webhook_event_id text PK, type, received_at, processed_at, error

settings           -- 配信設定（1行。管理画面から変更する）
  prepare_time '08:59', first_time '09:00', second_time '12:00', final_time '16:00',
  timezone 'Asia/Tokyo', updated_at

app_logs           -- エラー・ジョブのログ
  id, level, source, message, context jsonb, created_at
```

## 4. 処理フロー

### A. 登録
1. 友だち追加すると follow イベントが届き、ReplyでLIFFへのボタンを返す。リッチメニューにも「利用登録はこちら」を置く。
2. LIFFで `liff.init` を実行し、`liff.getIDToken()` で取得した **IDトークンだけ** をサーバーへ送る。userId はクライアント側で扱わない。
3. サーバーは `POST https://api.line.me/oauth2/v2.1/verify`（id_token, client_id=LoginチャネルID）でトークンを検証し、`sub` を userId とする【要公式確認】。
4. 役割に応じて検証する（利用者番号の有効性、userIdの重複、有効な通知者が3名を超えないか）。トランザクション内で保存し、登録完了を通知する。

### B. tick（毎分）
Postgres の advisory lock で多重起動を防いだうえで、全ステップを冪等に処理する。

1. **初期化**：JSTで初期化時刻を過ぎていれば、当日の `check_runs` と、有効な利用者全員分の `daily_checks(pending)` を `ON CONFLICT DO NOTHING` で作成する。
2. **1回目**：期限を過ぎていて `first_sent_at IS NULL` のものを `UPDATE … SET first_claimed_at=now() WHERE first_claimed_at IS NULL RETURNING` で確保してから送信する。結果は成功・失敗とも記録する。最終判定時刻を過ぎていれば送信せず `skipped` にする。
3. **2回目**：`status='pending'`、1回目送信済み、2回目未送信、かつ期限を過ぎているものだけに送信する。
4. **最終判定**：`UPDATE … SET status='notifying' WHERE status='pending' AND final_due_at<=now() AND first_sent_at IS NOT NULL RETURNING` で確保する。有効な通知者ごとに `notification_logs` をINSERTしてから送信し、1名が失敗しても残りへの送信は続ける。結果に応じて最終状態を `notified` / `notify_failed` / `no_notifier`（管理画面に警告）にする。
   - 1回目が一度も届いていない利用者については、通知者へは知らせない（誤報防止）。

### C. 回答（postback）
- postback の data は `v=1&a=ok&dc=<daily_check_id>`。
- Webhookの署名を検証し、`webhookEventId` で重複を除外する。送信元 userId がその daily_check の本人と一致するかを確認する。
- `UPDATE … SET status='answered', answered_at=now() WHERE id=$1 AND status='pending'` で更新する。回答済みなら変更しない。どちらの場合も「確認しました。ありがとうございます。」をReplyで返す（冪等）。
- 通知後に回答が来た場合は `answered_at` だけを記録し、状態は `notified` のまま残す。

### D. ブロック・ブロック解除
unfollow / follow イベントで `line_accounts.blocked_at` を更新し、管理画面に表示する。

### テストモード
`TEST_MODE=true` のとき、本番の日次実行回は自動では作らない。管理画面の「テスト実行」で `first=今`、`second=+3分`、`final=+6分` の `check_runs(kind='test')` を作成し、同じ tick ロジックで処理する。ローカルでは `npm run tick:loop`（30秒ごとに tick）で動かす。

## 5. 環境変数（`.env.local`。`.env.example` のみコミット）

```
DATABASE_URL=                     # Supabase接続文字列（パスワードを含む）
LINE_CHANNEL_SECRET=              # Messaging API
LINE_CHANNEL_ACCESS_TOKEN=        # Messaging API（長期トークン）
LINE_LOGIN_CHANNEL_ID=            # IDトークン検証時のclient_id
NEXT_PUBLIC_LIFF_ID=              # 公開しても問題ない値
CRON_SECRET=                      # /api/cron/tick 用のBearer
ADMIN_USERNAME=
ADMIN_PASSWORD_HASH=              # bcrypt
SESSION_SECRET=                   # 管理画面Cookieの署名用（32バイト以上）
APP_BASE_URL=
TEST_MODE=false
TEST_INTERVAL_MINUTES=3
DEFAULT_PREPARE_TIME=08:59
DEFAULT_FIRST_TIME=09:00
DEFAULT_SECOND_TIME=12:00
DEFAULT_FINAL_TIME=16:00
```

## 6. セキュリティ上の注意
- Webhook では、生のリクエストボディに対して `HMAC-SHA256(channelSecret)` をBase64化した値と `x-line-signature` をタイミング安全に比較し、一致しなければ401を返す。
- LIFFから送られてきた userId は信用せず、必ずIDトークンをサーバー側で検証する。
- LINE userId と電話番号は認証必須の管理画面（サーバーコンポーネント）でのみ表示し、一覧ではマスク表示にする。LIFF側のAPIレスポンスには含めない。
- cron エンドポイントは Bearer 認証で保護する（任意で Cloud Scheduler の OIDC トークン検証も追加）。
- 利用者番号を推測されると、第三者が通知者として登録できてしまう。対策は「8. 未決事項」の2を参照。
- 個人情報保護法への対応として、プライバシーポリシーと利用規約を用意し、登録画面に免責の注意書きを表示する。

## 7. 実装工程

| PHASE | 内容 | 完了条件 |
|---|---|---|
| 1 | 設計（本書）、Next.js/Drizzleの雛形、`.gitignore`、`.env.example`、README | `npm run build` が通る |
| 2 | LINEクライアント（Push/Reply、Retry-Key、ログ）、Webhookの署名検証、follow時の返信 | 実機で友だち追加 → 登録ボタンが届く |
| 3 | DBマイグレーション、TEST001シード、LIFF登録フォーム、IDトークン検証、登録API | 2アカウントでそれぞれ登録でき、DBで紐づいている |
| 4 | tick（初期化・1回目・2回目）、postbackでの回答、テストモード | 回答／未回答それぞれで状態遷移する |
| 5 | 最終判定と通知者への通知、notification_logs | 未回答 → 通知者に届く（E2E） |
| 6 | 管理画面（7画面）、今月の送信数（`message_logs` の集計と、LINE Quota API との突き合わせ【要公式確認】） | |
| 7 | Vitest（状態遷移・冪等性・重複実行）、Dockerfile、Cloud Run / Cloud Scheduler の手順書 | 本番デプロイ手順をREADMEに記載 |

各PHASEの終わりに、READMEへ「実装したもの／設定が必要なもの／テスト方法／未解決事項」を追記する。未実装の部分は `TODO:` と明記し、ダミー実装は作らない。

## LINE側で事前に必要な設定
1. LINEビジネスIDを作成し、LINE公式アカウントを作成する（未認証アカウントでも可）。
2. LINE Official Account Manager で Messaging API を有効化し、プロバイダーを決める（手順4と同じプロバイダーが必須。違うと userId が一致しない）。
3. LINE Developers の Messaging API チャネルで次を行う。
   - チャネルシークレットを控える
   - 長期チャネルアクセストークンを発行する
   - Webhook URL を設定し、「Webhookの利用」をONにする（URLはデプロイ後に設定）
   - 公式アカウント側の「応答メッセージ」をOFFにする
4. 同じプロバイダーで LINEログインチャネルを作成し、LIFFアプリを追加する。
   - サイズ：Full
   - エンドポイントURL：`https://<アプリ>/liff/register`
   - スコープ：openid, profile
   - 「友だち追加オプション」で公式アカウントをリンクする
5. LINEログインチャネルを「公開」にするか、テストに使う2アカウントをテスター／管理者として登録する（開発中のチャネルは関係者しかログインできない【要公式確認】）。
6. リッチメニューを作成し、「利用登録はこちら」に `https://liff.line.me/<LIFF_ID>` を設定する。
7. テスト用にLINEアカウントを2つ用意する（利用者役と通知者役）。

## 想定される技術的リスク
1. **送信通数の上限（最大のリスク）**：上限を超えると Push が失敗し、安否確認そのものが止まる。今月の送信数を管理画面に表示し、上限の80%で警告を出す。
2. **ブロックされた相手へのPush**：API のレスポンスでは失敗を検知できない可能性がある【要公式確認】。unfollow イベントでブロック状態を記録して補う。
3. **誤報**：LINEを開かない日がある、通知をOFFにしている等の理由で、元気でも「未回答」になる。運用上の説明が必要。
4. **LINEやCloud Runの障害**：1回目が届いていなければ通知者へは通知しない設計のため、障害時は検知が漏れる側に倒れる。
5. **Supabase 無料プランの制約**：一定期間アクセスがないと一時停止され、自動バックアップもない。停止判定の扱いは要確認。
6. Cloud Run のコールドスタートで、Webhook の応答に数秒かかることがある。

## 8. 未決事項（実装前にご判断いただく）
1. ホスティングを Cloud Run + Supabase（推奨）で進めてよいか。
2. 利用者番号の発行方式。推奨は「管理者が事前に発行（TEST001はシード）し、未発行の番号はエラー」。通知者は「利用者番号＋本人の電話番号下4桁」が一致した場合だけ登録できるようにする。
3. 通知後に本人が回答した場合、通知者へ「回答がありました」と追加送信するか（通数を消費する）。推奨はMVPでは送らずTODOとすること。
4. 開発環境から LINE 公式ドキュメント（developers.line.biz）へアクセスできるよう、ネットワーク許可を追加するか。
