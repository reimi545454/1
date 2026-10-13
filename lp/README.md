# 田んぼオーナー制度 LP

ビルド不要の静的サイト（HTML/CSS/JS）。`lp/` をそのまま任意の静的ホスティングに置けば公開できます。

```
python3 -m http.server -d lp 8000   # ローカル確認
```

## 公開前に必ず差し替える項目
- 屋号・住所・電話・メール・代表者名（`index.html` の footer / 特商法表記）
- プラン内容・価格・数量、募集区画数、実績数値（stats）、お客様の声（**現状は仮の文面**。実在の内容に置換すること）
- `canonical` / `og:image` のURL、OGP画像（`assets/ogp.png` 1200×630）
- 写真：現在はSVGイラスト。実際の田んぼの写真に差し替えると効果的
- フォーム送信先：`#entry-form` の `data-endpoint` にJSONを受けるURL（Formspree / Google Apps Script / 自前API等）を設定。未設定時は `data-mailto` のメールソフト起動にフォールバック
- プライバシーポリシー・特商法表記は法務確認のうえ確定
