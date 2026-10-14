# DocBench Architecture

## 統合静的アプリ

ルート`index.html`が現在の実装。要件定義・出力定義・入力フォームを同じWorkspaceで管理する。`#editor`は定義者画面、ハッシュなしは入力者画面。サーバ・AI・CDN・外部APIを実行時に使用しない。

| ファイル | 責務 |
| --- | --- |
| `src/core.js` | 項目・値の検証、JSON、履歴、ID単位の差分/三者マージ |
| `src/layout.js` | 公開された文章・表ノード、書式解決、項目参照、HTML表示 |
| `src/render.js` | 形式別デザイン、読取プレビュー、docx/ExcelJS/PptxGenJSによるネイティブ出力 |
| `src/designer.js` | 安全なShadow DOM、選択・並び替え・配置操作 |
| `src/editors.js` | Tiptap、Jspreadsheet CE、Konvaの編集操作をJSONの変更へ変換 |
| `src/app.js` | 画面、文脈に応じた書式UI、フォーム、ファイル、履歴、保存 |
| `src/specification.js` | ビルド時に内蔵する公開Markdown仕様 |
| `vendor/` | 固定版の実行時JS/CSSと第三者ライセンス |

選択・ズーム・ハンドル・ライブラリインスタンスは保存しない。編集変更だけを公開JSONに反映する。入力項目参照は値でなくパスを保存する。Wordの非テキストノードに不変`attrs.id`を付与し、複製時は再生成する。入力行の`_id`と別の名前空間で管理する。

WordはTiptapの文書フロー、Excelはセルモデル、PowerPointはcm座標で設計する。入力者のプレビューはscript禁止のsandbox iframeにBlob HTMLを読み込み、編集者側は親側のイベントハンドラーで操作する。Officeの自動改ページとフォント測定の完全な再現は行わない。

## 保存と配布

WorkspaceはIndexedDBの`docbench-workspace-v1`へ自動保存し、使用できない環境ではlocalStorageを利用する。共有は独立JSONまたはWorkspaceのJSON/gzip。添付をBase64で内包する。

`npm run build:portable`がアプリと仕様をASCII安全なHTMLへ組み込み、vendorは別ファイルで参照する。`portable/docbench.html`と隣の`vendor/`の位置関係を維持する。ランタイム一覧は`portable/build-manifest.json`。ライブラリの再生成は`scripts/editor-build/package-lock.json`と`build.mjs`を使用し、Nodeは開発時だけ必要。

## 旧TypeScript版

`src/definition-editor`、`src/render-designer`、`src/form-runtime`とVite設定は保持している。`npm run build`は旧TypeScript版を生成する。JSONとIndexedDBは統合静的アプリと独立し、形式交換は未対応。
