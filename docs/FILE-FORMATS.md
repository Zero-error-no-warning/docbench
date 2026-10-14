# ファイル形式

ルート`index.html`とportable版の正式な公開形式は[specification.md](specification.md)を参照する。`kind`、`formatVersion:1`、不変IDを持つDefinition / RenderDefinition / DocumentData / Workspaceを使用する。

RenderDefinitionには形式ごとの`designs`を持つ。Wordの`rich.content`は公開された文章・表・項目参照ノード、Excelはブロックとセル値/書式/結合/寸法、PowerPointはブロックと図形/配置を保存する。ライブラリの内部インスタンス、DOM、Canvas画像、入力値のコピーを保存しない。JSONは手編集とLLMによる生成に利用でき、取込時に参照・構造・寸法・IDを検証する。

DocumentDataの添付はBase64 data URLで内容を内包し、ファイル単体で共有できる。Array/Tableの入力行は`_id`、Wordの文章・表ノードは`attrs.id`で同一性を判定する。共有時にはJSON全体をgzip圧縮できる。

既存TypeScript版（`src/shared/types.ts`）の形式は独立した旧実装で、統合画面と互換ではない。
