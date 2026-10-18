# DocBench

入力情報の定義、フォーム入力、書類出力を分離した、ブラウザだけで動く書類作成プラットフォームの初版です。

- **動作確認**: https://zero-error-no-warning.github.io/docbench/
- **portable版HTML本体**: https://github.com/Zero-error-no-warning/docbench/blob/main/portable/docbench.html
- **入力者画面**: https://zero-error-no-warning.github.io/docbench/
- **編集者画面**: https://zero-error-no-warning.github.io/docbench/#editor
- [公開JSON仕様](docs/specification.md) / [要件と実装範囲](docs/requirements.md) / [操作ガイド](docs/manual.md)

画面上部は書類名と保存・履歴操作を1段にまとめ、工程選択を左サイドバーに配置しています。左上のボタンで折りたためます。書類全体の名前・説明は上部の書類名の横にある「書類名・説明」から編集できます。作成者・派生とDefinition／出力仕様はサイドバー下部から開きます。PC画面では作業領域をウィンドウの高さに収め、設定・入力・プレビューは各ペイン内でスクロールします。 条件や説明、型の管理は名前付きの開閉欄にまとめ、書類の複製・削除等は「書類の操作」から開きます。閉じた条件・説明欄にも設定の有無を表示します。通常ボタンの枠線を抑え、主操作・選択中の状態・キーボードフォーカスを色や下線で区別します。

## できること

左サイドバーの「新規書類」から、サンプルや既存データを引き継がない空の書類を作成できます。書類名・説明・最初の出力形式を指定し、作成前の内容はバックアップとUndoで戻せます。

「型を定義」で、入力構造・規則・表示設定を登録型として管理できます。標準の和暦年度・和暦年、部署等のTreeEnum（階層選択）、独自型の作成、既存項目からの登録に対応します。型を選ぶとすぐに使え、編集は同じ書式内の使用箇所へ反映します。型定義も書式全体のUndo・履歴で管理し、Definitionに同梱します。「型定義を保存」「型定義を読込」からTypeLibraryのJSON/gzipで他の書式へコピーできます。TreeEnumの選択肢はツリー操作とタブ字下げのテキスト編集を切り替えて編集できます。

1. **要件定義**: 項目を追加し、型・説明・必須条件・範囲・選択肢・セクション・グループを設定。Objectの子項目、Arrayの要素型、Tableの列も画面で編集できます。
   入力項目に「表示条件」を設定すると、種別などの入力に応じて項目・Object・表・列を切り替えられます。非表示の項目は入力検証・成果物出力から除き、保存値は保持して再表示時に復元します。要件定義の「表示・必須条件」から設定できます。
   「入力・表示」でObjectの子項目の横並び、接頭辞・接尾辞、数値の表示名を設定できます。空のObjectには和暦年の設定例を追加でき、元年は1として保存・表示し、0をエラーにします。
2. **条件を設計**: Rete.jsのノードエディタで入力値・固定値・比較・AND/OR/NOTを接続し、表示・必須・出力ブロック・書類生成へ再利用します。右ペインに設定と判定結果を表示。ノード名の部分一致検索と、名前・接続線だけのミニマップから移動できます。簡易条件UIと同じJSONを編集し、既存条件も引き継ぎます。
3. **出力定義**: 複数の書類を追加し、書類ごとに出力形式を選択して、Wordのページ・段落、Excelのセル・結合、PowerPointのスライド配置、HTML/PDFのCSSを設定。書類・形式ごとのデザインを独立して保存。書類の切替・複製・削除・既定の指定に対応し、入力者は共通の入力値から出力する書類を選択します。従来の単一書類JSONと履歴も読込時に変換します。WordはTiptapによる直接入力・文字範囲編集と任意の表・セル、ExcelはJspreadsheet CEによるセル編集・範囲書式、PowerPointはKonvaによる図形・文字の移動・サイズ変更・回転を操作できます。Wordでは文字書式・見出し・リストのツールバー、カーソル位置への項目挿入、マス目による表挿入、表全体/選択セルへの外枠・内側・各辺の罫線を操作できます。Wordは左操作ペインと右文書ペインに分け、表の操作欄を開閉しても文書位置を固定。再描画時もカーソル・選択・スクロールを維持します。Word・Excelは編集領域を広く表示し、詳細は「ページ・要素の設定」から開きます。条件付き出力、長文の別添化、表の行数分割、サンプルデータによるプレビューに対応します。
4. **入力・書類作成**: 自動生成したフォームに入力し、検証してHTML / Word (.docx) / Excel (.xlsx) / PowerPoint (.pptx) を出力。PDFはブラウザの印刷画面で保存します。
5. **履歴・派生**: 作成者・日時・親状態付きスナップショット、コメント、派生、差分、三者マージ、競合の選択・値編集、マージ後の制約検証。Undo / Redoと自動保存、スナップショット記録・読込・マージ前のバックアップにも対応します。
6. **共有**: Definition / Render Definition / Document Data / 全体WorkspaceをJSONまたはJSON + gzipで保存・読込。ファイル添付は内容をBase64で内包します。

配列位置で同一性を判断せず、不変の`_id`で行を識別します。複製時はIDを振り直し、作成元IDを残します。異なる項目への変更を自動統合し、同一項目への異なる変更、削除対変更、同一要素の異なる移動先などは競合として表示します。

## 外部LLMからの作成

[公開JSON仕様](docs/specification.md)を、現在のDefinition・RenderDefinitionと一緒に外部LLMへ渡せます。完全なJSONを生成し、「保存・読込 → JSONを貼り付けて読み込む」から取り込みます。入力項目・条件も変更するときはDefinitionを先に読み込みます。仕様の冒頭に依頼文と生成・読込の手順を掲載しています。

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

JSZip 3.10.1、pako 1.0.11、docx 9.6.1、PptxGenJS 4.0.1に加え、Tiptap 3.32.0、Jspreadsheet CE 5.0.4、jSuites 5.12.0、ExcelJS 4.4.0、Konva 10.0.12をローカル同梱しています。これらにRete 2.0.6と関連プラグイン、Lit 3.3.3を追加しています。Rete等はMIT、Lit関連はBSD-3-Clauseです。条件エディタ用の`vendor/rete.min.js`も配置してください。ビルド用rJSmin 1.3.0はApache-2.0です。出典とライセンスは[公開仕様](docs/specification.md#第三者ライブラリ)と`vendor/`を参照してください。

## 既存TypeScript版との統合

既存の`src/definition-editor`、`src/render-designer`、`src/form-runtime`とVite/TypeScript設定は保持しています。従来の`npm run build`はTypeScript版をビルドします。今回の統合画面はルート`index.html`、portable生成は`npm run build:portable`です。JSON形式と保存領域は初版では独立しており、TypeScript版とのファイル交換は未対応です。
