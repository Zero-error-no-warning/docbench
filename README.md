# DocBench

入力情報の定義、フォーム入力、書類出力を分離した、ブラウザだけで動く書類作成プラットフォームの初版です。

- **動作確認**: https://zero-error-no-warning.github.io/docbench/
- **portable版HTML本体**: https://github.com/Zero-error-no-warning/docbench/blob/main/portable/docbench.html
- **入力者画面**: https://zero-error-no-warning.github.io/docbench/
- **編集者画面**: https://zero-error-no-warning.github.io/docbench/#editor
- [公開JSON仕様](docs/specification.md) / [要件と実装範囲](docs/requirements.md) / [操作ガイド](docs/manual.md)

## できること

1. **要件定義**: 項目を追加し、型・説明・必須条件・範囲・選択肢・セクション・グループを設定。Objectの子項目、Arrayの要素型、Tableの列も画面で編集できます。
2. **出力定義**: 最初に出力形式を選択し、Wordのページ・段落、Excelのセル・結合、PowerPointのスライド配置、HTML/PDFのCSSを設定。形式ごとのデザインを独立して保存。WordはTiptapによる文字範囲編集と任意の表・セル、ExcelはJspreadsheet CEによるセル編集・範囲書式、PowerPointはKonvaによる図形・文字の移動・サイズ変更・回転を操作できます。選択した要素の詳細だけを表示します。条件付き出力、長文の別添化、表の行数分割、サンプルデータによるプレビューに対応します。
3. **入力・書類作成**: 自動生成したフォームに入力し、検証してHTML / Word (.docx) / Excel (.xlsx) / PowerPoint (.pptx) を出力。PDFはブラウザの印刷画面で保存します。
4. **履歴・派生**: 作成者・日時・親状態付きスナップショット、コメント、派生、差分、三者マージ、競合の選択・値編集、マージ後の制約検証。Undo / Redoと自動保存、スナップショット記録・読込・マージ前のバックアップにも対応します。
5. **共有**: Definition / Render Definition / Document Data / 全体WorkspaceをJSONまたはJSON + gzipで保存・読込。ファイル添付は内容をBase64で内包します。

配列位置で同一性を判断せず、不変の`_id`で行を識別します。複製時はIDを振り直し、作成元IDを残します。異なる項目への変更を自動統合し、同一項目への異なる変更、削除対変更、同一要素の異なる移動先などは競合として表示します。

## Portable版

アプリ本体は **`portable/docbench.html`**、ライブラリは **`vendor/`** に分けています。両方をリポジトリと同じ位置関係で保存してください。HTMLだけでは起動しません。必要なファイル一覧は`portable/build-manifest.json`の`runtimeFiles`にあります。

- `配置先/portable/docbench.html`
- `配置先/vendor/`（JS・CSS・ライセンスを含むフォルダー）

HTMLはRaw表示からコピーしてUTF-8で保存しても利用できます。アプリのJS・CSS・仕様書はHTML内にあり、JSはminify + gzip + Base64、HTML本体はASCIIで保持します。ライブラリを同梱HTMLへ再圧縮しないため、各ファイルを独立して更新できます。実行時のCDN・外部API接続・npm・サーバ処理はありません。SharePointへ配置する場合も上記の位置関係を維持してください。

GitHub Pages版とportable版は同じソースから生成します。URL末尾に`#editor`を付けると編集者画面、付けないと入力者画面です。上部の切替ボタンで相互に移動できます。従来の`?mode=user`も入力者画面で開きます。JSONをメール等で共有する際のファイル保存は、導入用コピーとは別の操作です。

## 想定環境と初版の範囲

現行Edge / Chrome、ローカルファイル、HTTPの静的配置を想定します。IEモード・古いInternet Explorerは対象外です。SharePoint Classicには静的ページの実行が許可されたドキュメントライブラリへ配置してください。HTMLがダウンロード扱いになるなどの構成差は配置先で確認が必要です。

- 入力者モードはUIの切替であり、アクセス権管理ではありません。
- Office出力は各形式の書式・配置を反映します。既存のDOCX/XLSX/PPTXテンプレートへの差込は未対応です。編集画面はTiptap・Jspreadsheet・Konva、入力者のプレビューはHTMLによる近似であり、Officeでの自動改ページ・折返し・文字縮小は実ファイルで確認してください。
- `{{projectName}}`形式のHTMLテンプレートはHTML・PDF用。Office出力ではブロック配置を使います。
- RichTextは安全なHTMLタグを許可し、Word/PPTXでは太字・斜体・下線を保持します。Excelでは文字列になります。画像はHTML・Word・Excel・PPTXへ埋め込み、GIF/WebPはOffice向けにPNGへ変換します。
- 複合業務キー、任意の要素間式、計算式・他項目の動的参照、汎用的な高度な並び順ルールは未実装です。単一列のキー重複と昇順・降順は検証します。
- マージの複雑な値統合・行の追加/復元/移動を含む競合解決には、初版ではJSON編集を併用します。個別の変更採用はボタンで操作できます。
- 履歴は状態を保存するDAGです。サーバ同期・同時編集・ユーザー認証は行いません。添付は1件10MB、JSONは展開後80MBまで。大きな履歴では保存領域とマージ計算量に注意が必要です。
- DefinitionやRender Definitionを単独保存するときは、その種類だけの履歴を含めます。入力値や添付を混入しません。派生を持ち寄ってマージする場合は全体Workspaceを共有してください。

## 開発・検証

```sh
npm --prefix scripts/qa install --ignore-scripts
npm run build:portable
npm run test:offline
./scripts/qa/node_modules/.bin/playwright install chromium
npm run test:browser
```

portable生成はPython標準ライブラリと同梱rJSminで実行できます。エディターライブラリを再生成する場合は`npm ci --prefix scripts/editor-build --ignore-scripts`と`node scripts/editor-build/build.mjs`を実行します。実行時依存は`vendor/`に固定して同梱し、npmは開発・検証でのみ使用します。

GitHub Actionsはテスト・portable生成・Chromiumでの画面操作とオフライン出力検証を実施して、mainをGitHub Pagesへ公開します。スクリーンショットは`browser-verification` artifactに保存します。初回公開で自動有効化が権限上できない場合は、リポジトリの **Settings → Pages → Source: GitHub Actions** を設定して再実行してください。

## ライブラリ

JSZip 3.10.1、pako 1.0.11、docx 9.6.1、PptxGenJS 4.0.1に加え、Tiptap 3.32.0、Jspreadsheet CE 5.0.4、jSuites 5.12.0、ExcelJS 4.4.0、Konva 10.0.12をローカル同梱しています。いずれも同梱する範囲はMITです。ビルド用rJSmin 1.3.0はApache-2.0です。出典とライセンスは[公開仕様](docs/specification.md#第三者ライブラリ)と`vendor/`を参照してください。

## 既存TypeScript版との統合

既存の`src/definition-editor`、`src/render-designer`、`src/form-runtime`とVite/TypeScript設定は保持しています。従来の`npm run build`はTypeScript版をビルドします。今回の統合画面はルート`index.html`、portable生成は`npm run build:portable`です。JSON形式と保存領域は初版では独立しており、TypeScript版とのファイル交換は未対応です。
