<?php
/**
 * お問い合わせフォーム送信処理（NeweZ 法人向け 田んぼオーナー制度 LP）
 * 対象フォーム: index.html（source=lp）/ estimate.html（source=estimate）
 *
 * ブルーベリーLPの submit.php と同じ方式（mb_send_mail → thanks.html へリダイレクト）。
 * 要件: PHP 7.4+ / mbstring / サーバーのメール送信設定（sendmail 等）。
 *
 * ・問い合わせの宛先は info-ricefield@newez-farming.jp。
 * ・送信元(From)はブルーベリーLPと同じ noreply@newez-farming.jp を引き継いでいます（要確認）。
 * ・「配布予定人数」と「1人あたりの配布予定kg数」が両方入力された場合は、
 *   合計kg数（人数×1人あたりkg）から口数と概算予算を計算し、自動返信メール（と社内向けメール）に載せる。
 *   計算の単価は下の「設定」を変更する。
 * ・社内向けメールには、お客様へ送った自動返信の文面も載せる。
 */

mb_language('Japanese');
mb_internal_encoding('UTF-8');
date_default_timezone_set('Asia/Tokyo');

// === 設定 =====================================================================
$to      = 'info-ricefield@newez-farming.jp'; // 管理者宛（複数はカンマ区切り）
$from    = 'noreply@newez-farming.jp';   // 送信元（自ドメイン推奨） ※要確認
$reply_to_admin = 'info-ricefield@newez-farming.jp'; // 自動返信の返信先（お客様が返信した場合の宛先）
$site_url = 'https://newez.jp/';
$thanks   = 'thanks.html';
$contact_within = '3営業日以内'; // 「営業担当より◯◯にご連絡します」の期限

// 流入元ごとの件名・自動返信の書き出し・表示名（社内で、どこから来たか分かるようにする）
$sources = [
    'lp'       => ['subject'     => '【NeweZ LP】法人向け田んぼオーナー制度 お問い合わせ',
                   'autoreply'   => '【自動返信】お問い合わせありがとうございます（NeweZ）',
                   'thanks_word' => 'お問い合わせありがとうございます。',
                   'copy_title'  => 'お問い合わせ内容（控え）',
                   'received'    => 'お問い合わせ',
                   'label'       => 'LPのお問い合わせフォーム'],
    'estimate' => ['subject'     => '【NeweZ LP｜簡単お見積もり】法人向け田んぼオーナー制度 お見積もり依頼',
                   'autoreply'   => '【自動返信】お見積もり依頼ありがとうございます（NeweZ）',
                   'thanks_word' => 'お見積もり依頼ありがとうございます。',
                   'copy_title'  => 'お見積もり依頼内容（控え）',
                   'received'    => 'お見積もり依頼',
                   'label'       => '簡単お見積もり（estimate.html）経由'],
];

// 概算の計算（金額はすべて税別・円）
// 合計kg ＝ 配布予定人数 × 1人あたりの配布予定kg数 → 口数 ＝ ⌈ 合計kg ÷ 1口あたりkg ⌉
$KG_PER_KUCHI    = 216;     // 1口あたりの白米（kg）
$GENMAI_PER_KUCHI = 240;    // 1口あたりの玄米（kg）。精米で約1割減 → 白米216kg（メール文面の説明用）
$PRICE_PER_KUCHI = 250000;  // 参加費（1口）
$FEE_PER_BAG     = 1000;    // 小分け手数料（1袋）。税込では1,100円。※概算には含めず、メールで案内のみ

// 選択式項目の許可リスト（index.html の option と同じ文言にすること）
$allowed_purpose   = ['社員への福利厚生', '取引先への贈答', '両方', 'その他', '未定'];
$allowed_packaging = ['通常30kg袋', '2kg・3kg・5kg', '450g贈答用', 'オリジナル包装', '相談して決めたい'];

$MAX_PEOPLE = 100000;
$MAX_KG_PER_PERSON = 1000; // 1人あたりの配布予定kg数の上限（誤入力防止。0.45 のような小数も可）
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
/** 全角数字→半角、カンマ・空白を除去（form.js の normalizeNumber と同じ） */
function normalize_number(string $v): string {
    $v = mb_convert_kana($v, 'n', 'UTF-8');
    $v = str_replace(['．', '。'], '.', $v);
    return preg_replace('/[,\s、，]/u', '', $v);
}
function yen(int $n): string {
    return number_format($n) . '円';
}

/** kgの表示（小数の末尾の0を除く）。例: 150 → "150"、22.5 → "22.5" */
function kg_fmt(float $v): string {
    return rtrim(rtrim(number_format($v, 3, '.', ''), '0'), '.');
}

/**
 * 口数と概算予算を計算する（小分け手数料は含めない）。
 * @param int   $people         配布予定人数
 * @param float $kg_per_person  1人あたりの配布予定kg数（白米）
 * @return array{total_kg:float, kuchi:int, join_fee:int, total:int}
 */
function estimate_for(int $people, float $kg_per_person): array {
    global $KG_PER_KUCHI, $PRICE_PER_KUCHI;
    $total_kg = round($people * $kg_per_person, 3);
    // 小数の誤差で1口多くならないよう、丸めてから切り上げる
    $kuchi    = max(1, (int)ceil(round($total_kg / $KG_PER_KUCHI, 9)));
    $join_fee = $kuchi * $PRICE_PER_KUCHI;
    return ['total_kg' => $total_kg, 'kuchi' => $kuchi, 'join_fee' => $join_fee, 'total' => $join_fee];
}

$company   = field('company', 100);
$name      = field('name', 100);
$email     = field('email', 254);
$tel       = field('tel', 20);
$people_raw = normalize_number(field('people', 20));
$kg_raw     = normalize_number(field('kg', 20));
$purpose   = field('purpose', 50);
$packaging = field('packaging', 50);
$message   = field('message', 2000);
$form_url  = field('form_url', 500);
if ($form_url === '') {
    $form_url = $_SERVER['HTTP_REFERER'] ?? '';
}
$source_key = field('source', 20);
if (!isset($sources[$source_key])) {
    $source_key = 'lp';
}
$source = $sources[$source_key];

// 必須チェック（JS検証をすり抜けた場合・JS無効の場合に備える）
$errors = [];
if ($company === '') $errors[] = '会社名が未入力です。';
if ($name === '')    $errors[] = 'ご担当者名が未入力です。';
if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'メールアドレスが不正です。';
if (empty($_POST['agree'])) $errors[] = '個人情報の取扱いへの同意が必要です。';
if ($purpose !== '' && !in_array($purpose, $allowed_purpose, true))     $errors[] = 'ご希望の用途の値が不正です。';
if ($packaging !== '' && !in_array($packaging, $allowed_packaging, true)) $errors[] = '小分け・包装のご希望の値が不正です。';

// 配布予定人数・kg数: 片方を入力したらもう片方も必須（estimateは両方必須）
$people = 0;
$kg = 0.0;
$is_estimate = ($source_key === 'estimate');
if ($is_estimate && $people_raw === '') {
    $errors[] = '配布予定人数が未入力です。';
}
if ($is_estimate && $kg_raw === '') {
    $errors[] = '1人あたりの配布予定kg数が未入力です。';
}
if ($people_raw !== '') {
    if (!preg_match('/^\d+$/', $people_raw) || (int)$people_raw < 1 || (int)$people_raw > $MAX_PEOPLE) {
        $errors[] = '配布予定人数は1〜' . number_format($MAX_PEOPLE) . 'の半角数字で入力してください。';
    } else {
        $people = (int)$people_raw;
    }
    if ($kg_raw === '' && !$is_estimate) { // estimateは上で既にエラー追加済み
        $errors[] = '配布予定人数を入力した場合は、1人あたりの配布予定kg数も入力してください。';
    }
}
if ($kg_raw !== '') {
    if ($people_raw === '' && !$is_estimate) { // estimateは上で既にエラー追加済み
        $errors[] = '1人あたりの配布予定kg数を入力した場合は、配布予定人数も入力してください。';
    }
    if (!preg_match('/^\d+(\.\d+)?$/', $kg_raw) || (float)$kg_raw <= 0 || (float)$kg_raw > $MAX_KG_PER_PERSON) {
        $errors[] = '1人あたりの配布予定kg数は、0より大きく' . number_format($MAX_KG_PER_PERSON) . '以下の半角数字で入力してください。';
    } else {
        $kg = (float)$kg_raw;
    }
}

if (!empty($errors)) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=UTF-8');
    echo "送信エラー：\n- " . implode("\n- ", $errors) . "\n\nブラウザの「戻る」で入力内容をご確認ください。";
    exit;
}

$clean_email = one_line($email);
$now = date('Y-m-d H:i:s');
$ip  = $_SERVER['REMOTE_ADDR'] ?? '';

// 人数と1人あたりkg数の両方があれば概算を計算
$est = ($people > 0 && $kg > 0) ? estimate_for($people, $kg) : null;
$people_disp = $people > 0 ? "{$people}人" : '';
$kg_disp = $kg > 0 ? kg_fmt($kg) . 'kg' : '';
$total_disp = $est ? kg_fmt($est['total_kg']) . 'kg' : '';

// ---- お客様宛の自動返信（本文）----
// 文面は2パターン:
//   A) 人数と1人あたりkg数が入力されている（LP・簡単お見積もりとも） → 口数と概算予算つき
//   B) LP経由で人数・kg数が空 → 金額なし（担当者がご案内）
if ($est) {
    $reply = "このたびは、田んぼオーナー制度のお見積もりをご依頼いただき、誠にありがとうございます。\n\n"
           . "ご入力内容をもとに、必要な口数と概算予算をご案内いたします。\n\n"
           . "【ご入力内容】\n"
           . "・配布予定人数：{$people_disp}\n"
           . "・1人あたりの配布予定量：白米{$kg_disp}\n"
           . "・配布予定量の合計：白米{$total_disp}\n\n"
           . "上記の量を1回配布する場合、必要な口数は{$est['kuchi']}口、概算予算は" . yen($est['total']) . "（税別）です。\n\n"
           . "※1口あたり白米{$KG_PER_KUCHI}kgを基準に計算しています。玄米{$GENMAI_PER_KUCHI}kgを精米する際、重量が約1割減る想定です。\n\n"
           . "【内訳（税別）】\n"
           . "・参加費：{$est['kuchi']}口 × " . yen($PRICE_PER_KUCHI) . "＝" . yen($est['join_fee']) . "\n"
           . "・概算予算合計：" . yen($est['total']) . "\n\n"
           . "※上記は自動計算による概算です。正式なお見積もりは、担当者よりご案内いたします。\n"
           . "※小分け手数料は、上記の概算予算に含まれていません。小分け（2kg・3kg・5kg／450g）をご希望の場合は、1袋あたり" . yen($FEE_PER_BAG) . "（税別）が別途かかります。\n\n"
           . "営業担当より{$contact_within}にご連絡いたします。\n"
           . "今しばらくお待ちくださいますようお願いいたします。";
} else {
    $reply = "{$source['thanks_word']}\n\n"
           . "ご入力内容を確認のうえ、担当者よりご案内いたします。\n\n"
           . "営業担当より{$contact_within}にご連絡いたします。\n"
           . "今しばらくお待ちください。";
}
$reply_full = "{$company}\n{$name} 様\n\n{$reply}";

// ---- 社内向けメール（入力内容 ＋ 自動計算 ＋ お客様へ送った自動返信）----
$est_admin = $est
    ? "■ 自動計算（概算）： 大体{$est['kuchi']}口 / 予算 " . yen($est['total']) . "（税別）\n"
      . "　配布予定量の合計： {$people_disp} × {$kg_disp} ＝ {$total_disp}（1口＝{$KG_PER_KUCHI}kg）\n"
      . "　参加費： {$est['kuchi']}口 × " . yen($PRICE_PER_KUCHI) . " ＝ " . yen($est['join_fee']) . "（税別）\n"
      . "　※小分け手数料（1袋" . yen($FEE_PER_BAG) . "・税別）は概算に含めていません。\n"
    : "■ 自動計算（概算）： なし（人数・1人あたりkg数が未入力）\n";

$body = <<<EOT
【NeweZ LP】より以下の内容で{$source['received']}を受け付けました。
■ 流入元： {$source['label']}

━━━━━━━━━━━━━━━━━━━━━━
■ 会社名： {$company}
■ ご担当者名： {$name}
■ メール： {$email}
■ 電話番号： {$tel}
■ 配布予定人数（従業員数）： {$people_disp}
■ 1人あたりの配布予定kg数（白米）： {$kg_disp}
■ ご希望の用途： {$purpose}
■ 小分け・包装のご希望： {$packaging}
■ お問い合わせ内容：
{$message}

{$est_admin}
━━━━━━━━━━━━━━━━━━━━━━
送信日時： {$now}
送信元ページ： {$form_url}
送信IP： {$ip}
EOT;

$admin_body = $body . "\n\n"
    . "━━━━━━━━━━━━━━━━━━━━━━\n"
    . "【お客様へ自動返信した内容】\n"
    . "件名： {$source['autoreply']}\n"
    . "宛先： {$clean_email}\n"
    . "――――――――――――――――――\n"
    . $reply_full . "\n"
    . "――――――――――――――――――\n"
    . "（お客様宛のメールには、上記に続けて入力内容の控えも付きます）\n";

// 管理者宛
$headers  = "From: {$from}\r\n";
$headers .= "Reply-To: {$clean_email}\r\n";
$sent_admin = mb_send_mail($to, $source['subject'], $admin_body, $headers);

// 本人宛 自動返信（失敗しても管理者宛が届いていれば完了扱い）
$autores_body = <<<AUTO
{$reply_full}

――――――――――――――――――
■ {$source['copy_title']}
{$body}
――――――――――――――――――

NeweZ株式会社
URL: {$site_url}
AUTO;
$autores_headers  = "From: {$from}\r\n";
$autores_headers .= "Reply-To: {$reply_to_admin}\r\n";
mb_send_mail($clean_email, $source['autoreply'], $autores_body, $autores_headers);

if ($sent_admin) {
    // 計測で「簡単お見積もり経由」を区別できるよう、完了ページに流入元を渡す
    header('Location: ' . $thanks . ($source_key === 'estimate' ? '?from=estimate' : ''));
    exit;
}

http_response_code(500);
header('Content-Type: text/plain; charset=UTF-8');
echo "メール送信に失敗しました。お手数ですが、時間をおいて再度お試しください。\n";
// 管理者向けの詳細は画面に出さずサーバーログへ
error_log('[newez-lp] mb_send_mail failed (admin). Check mbstring / sendmail settings.');
exit;
