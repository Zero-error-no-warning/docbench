# DocBench Architecture

## 統合静的アプリ

ルート`index.html`が現在の実装。要件定義・出力定義・入力フォームを同じWorkspaceで管理する。`#editor`は定義者画面、ハッシュなしは入力者画面。サーバ・AI・CDN・外部APIを実行時に使用しない。

| ファイル | 責務 |
| --- | --- |
| `src/core.js` | 項目・値の検証、JSON、履歴、ID単位の差分/三者マージ |
| `src/layout.js` | 公開された文章・表ノード、書式解決、項目参照、HTML表示 |
| `src/render.js` | 形式別デザイン、読取プレビュー、docx/ExcelJS/PptxGenJSによるネイティブ出力 |
| `src/designer.js` | 安全なShadow DOM、選択・並び替え・配置操作 |
| `src/word-model.js` | Wordの参照・制御範囲、公開ブロックと編集用文書の相互変換 |
| `src/word-format.js` | 段落書式、段落・文字・表スタイルの継承、番号・タブの共通モデルと検証 |
| `src/word-export.js` | Wordのスタイル参照、文字単位インデント、番号階層のネイティブOOXML出力 |
| `src/word-editor.js` | 単一Tiptap文書の選択・クリップボード・履歴・表・差し込み操作 |
| `src/word-format-ui.js` | 段落・スタイル・タブ・階層番号の設定画面、ルーラー |
| `src/editors.js` | Jspreadsheet CE、Konvaの編集操作をJSONの変更へ変換 |
| `src/app.js` | 画面、文脈に応じた書式UI、フォーム、ファイル、履歴、保存 |
| `src/specification.js` | ビルド時に内蔵する公開Markdown仕様 |
| `vendor/` | 固定版の実行時JS/CSSと第三者ライセンス |

選択・ズーム・ハンドル・ライブラリインスタンスは保存しない。編集変更だけを公開JSONに反映する。入力項目参照は値でなくパスを保存する。Wordの非テキストノードに不変`attrs.id`を付与し、複製時は再生成する。入力行の`_id`と別の名前空間で管理する。

Wordは単一Tiptap文書、Excelはセルモデル、PowerPointはcm座標で設計する。Wordの`wordSection`と`wordObject`は編集時だけのコンテナで、公開JSONへは従来のblocksとrich.contentを保存する。要素境界をまたぐ選択・コピー・削除・履歴をTiptapが一括管理し、要素ID・書式・条件・参照先をコンテナから元のブロックへ戻す。未入力の挿入用空白は保存しない。

Wordのスタイルは文書内のIDで参照し、継承した値を段落や文字へ焼き込まない。画面・読取プレビュー・DOCXが同じ解決処理を使う。DOCXにもbasedOn・next・pStyle・rStyle・tblStyleを保存し、継承する書式を直接書式で隠さない。番号のカウンター・表示ラベル・タブの計測幅は一時情報で、出力定義へ保存しない。docx 9.6.1が公開APIで表現しない文字単位の属性はprepForXmlの結果へ付加し、lvlRestart・番号と見出しのリンクは生成済みnumbering.xmlへ追加する。

入力者のプレビューはscript禁止のsandbox iframeにBlob HTMLを読み込み、編集者側は親側のイベントハンドラーで操作する。現在のプレビューに自動ページ分割・Officeと同じフォント測定はない。デスクトップ版Wordに近い編集・組版・出力を目標として、[Word対応計画](word-roadmap.md)の順で拡張する。

## 保存と配布

WorkspaceはIndexedDBの`docbench-workspace-v1`へ自動保存し、使用できない環境ではlocalStorageを利用する。共有は独立JSONまたはWorkspaceのJSON/gzip。添付をBase64で内包する。

`npm run build:portable`がアプリと仕様をASCII安全なHTMLへ組み込み、vendorは別ファイルで参照する。`portable/docbench.html`と隣の`vendor/`の位置関係を維持する。ランタイム一覧は`portable/build-manifest.json`。ライブラリの再生成は`scripts/editor-build/package-lock.json`と`build.mjs`を使用し、Nodeは開発時だけ必要。

## 旧TypeScript版

`src/definition-editor`、`src/render-designer`、`src/form-runtime`とVite設定は保持している。`npm run build`は旧TypeScript版を生成する。JSONとIndexedDBは統合静的アプリと独立し、形式交換は未対応。
