<?php
/**
 * お問い合わせフォーム送信処理（NeweZ 法人向け 田んぼオーナー制度 LP）
 *
 * ブルーベリーLPの submit.php と同じ方式（mb_send_mail → thanks.html へリダイレクト）。
 * 要件: PHP 7.4+ / mbstring / サーバーのメール送信設定（sendmail 等）。
 *
 * 【公開前に必ず確認】下の「設定」の宛先・送信元・件名は、ブルーベリーLPの設定を
 * そのまま引き継いでいます。この田んぼオーナー制度LPの正しい宛先か確認してください。
 */

mb_language('Japanese');
mb_internal_encoding('UTF-8');
date_default_timezone_set('Asia/Tokyo');

// === 設定 =====================================================================
$to      = 'info@newez-farming.jp, misawa@newez.jp, hirayama@newez.jp'; // 管理者宛（カンマ区切り） ※要確認
$from    = 'noreply@newez-farming.jp';   // 送信元（自ドメイン推奨）           ※要確認
$reply_to_admin = 'info@newez-farming.jp'; // 自動返信の返信先                  ※要確認
$subject = '【NeweZ LP】法人向け田んぼオーナー制度 お問い合わせ';
$autores_subject = '【自動返信】お問い合わせありがとうございます（NeweZ）';
$site_url = 'https://newez.jp/';
$thanks   = 'thanks.html';

// 選択式項目の許可リスト（index.html の option と同じ文言にすること）
$allowed_purpose   = ['社員への福利厚生', '取引先への贈答', '両方', 'その他', '未定'];
$allowed_packaging = ['通常30kg袋', '2kg・3kg・5kg', '450g贈答用', 'オリジナル包装', '相談して決めたい'];
// ============================================================================

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Location: index.html');
    exit;
}

// bot対策（honeypot）。入力があれば何も返さず終了
if (!empty($_POST['website'])) {
    exit;
}

/** 文字列を取得して前後の空白を除去し、最大長で切る */
function field(string $key, int $max): string {
    $v = isset($_POST[$key]) && is_string($_POST[$key]) ? trim($_POST[$key]) : '';
    return mb_substr($v, 0, $max);
}
/** メールヘッダに入りうる値から改行を除去（ヘッダインジェクション対策） */
function one_line(string $v): string {
    return str_replace(["\r", "\n", "\0"], ' ', $v);
}

$company   = field('company', 100);
$name      = field('name', 100);
$email     = field('email', 254);
$tel       = field('tel', 20);
$people    = field('people', 50);
$purpose   = field('purpose', 50);
$packaging = field('packaging', 50);
$message   = field('message', 2000);
$form_url  = field('form_url', 500);
if ($form_url === '') {
    $form_url = $_SERVER['HTTP_REFERER'] ?? '';
}

// 必須チェック（JS検証をすり抜けた場合・JS無効の場合に備える）
$errors = [];
if ($company === '') $errors[] = '会社名が未入力です。';
if ($name === '')    $errors[] = 'ご担当者名が未入力です。';
if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'メールアドレスが不正です。';
if (empty($_POST['agree'])) $errors[] = '個人情報の取扱いへの同意が必要です。';
if ($purpose !== '' && !in_array($purpose, $allowed_purpose, true))     $errors[] = 'ご希望の用途の値が不正です。';
if ($packaging !== '' && !in_array($packaging, $allowed_packaging, true)) $errors[] = '小分け・包装のご希望の値が不正です。';

if (!empty($errors)) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=UTF-8');
    echo "送信エラー：\n- " . implode("\n- ", $errors) . "\n\nブラウザの「戻る」で入力内容をご確認ください。";
    exit;
}

$clean_email = one_line($email);
$now = date('Y-m-d H:i:s');
$ip  = $_SERVER['REMOTE_ADDR'] ?? '';

// 本文（プレーンテキストメール。HTMLとして解釈されないのでエスケープ不要）
$body = <<<EOT
【NeweZ LP】より以下の内容でお問い合わせを受け付けました。

━━━━━━━━━━━━━━━━━━━━━━
■ 会社名： {$company}
■ ご担当者名： {$name}
■ メール： {$email}
■ 電話番号： {$tel}
■ 配布予定人数： {$people}
■ ご希望の用途： {$purpose}
■ 小分け・包装のご希望： {$packaging}
■ お問い合わせ内容：
{$message}

━━━━━━━━━━━━━━━━━━━━━━
送信日時： {$now}
送信元ページ： {$form_url}
送信IP： {$ip}
EOT;

// 管理者宛
$headers  = "From: {$from}\r\n";
$headers .= "Reply-To: {$clean_email}\r\n";
$sent_admin = mb_send_mail($to, $subject, $body, $headers);

// 本人宛 自動返信（失敗しても管理者宛が届いていれば完了扱い）
$autores_body = <<<AUTO
{$company}
{$name} 様

このたびはNeweZの法人向け田んぼオーナー制度について
お問い合わせいただき、誠にありがとうございます。
担当者より、最短1営業日以内にご連絡いたします。

――――――――――――――――――
■ お問い合わせ内容（控え）
{$body}
――――――――――――――――――

NeweZ株式会社
URL: {$site_url}
AUTO;
$autores_headers  = "From: {$from}\r\n";
$autores_headers .= "Reply-To: {$reply_to_admin}\r\n";
mb_send_mail($clean_email, $autores_subject, $autores_body, $autores_headers);

if ($sent_admin) {
    header("Location: {$thanks}");
    exit;
}

http_response_code(500);
header('Content-Type: text/plain; charset=UTF-8');
echo "メール送信に失敗しました。お手数ですが、時間をおいて再度お試しください。\n";
// 管理者向けの詳細は画面に出さずサーバーログへ
error_log('[newez-lp] mb_send_mail failed (admin). Check mbstring / sendmail settings.');
exit;
