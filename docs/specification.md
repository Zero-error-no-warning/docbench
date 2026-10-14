# DocBench JSON形式 v1

本仕様は初版0.1の実装に対応する。UTF-8 JSONを使用し、共有時は全体をgzipで圧縮できる。ランタイムにはAI機能・外部通信・サーバ処理を持たせない。

## 共通形式

`kind`は`Definition` / `RenderDefinition` / `DocumentData` / `Workspace`、`formatVersion`は`1`。ルートと定義項目・出力ブロックに一意な`id`を持つ。`constructor` / `prototype` / `__proto__`をプロパティ名に使用しない。対応していない版のファイルは自動解釈しない。

## Definition

```json
{
  "kind": "Definition", "formatVersion": 1,
  "id": "definition-1", "title": "報告書", "description": "入力ガイド",
  "fields": [
    {"id":"field-name","key":"projectName","label":"事業名","type":"String","required":true,"maxLength":100,"section":"基本情報","group":"","description":""},
    {"id":"field-budget","key":"budget","label":"予算","type":"Integer","min":0},
    {"id":"field-table","key":"expenses","label":"支出","type":"Table",
      "minItems":1,"maxItems":30,"initialRows":1,"rowLabel":"支出",
      "allowAdd":true,"allowDelete":true,"allowDuplicate":true,"allowReorder":true,
      "businessKey":"category","uniqueBy":"category","sortBy":"amount","sortDirection":"asc",
      "fields":[
        {"id":"field-category","key":"category","label":"区分","type":"String","required":true},
        {"id":"field-amount","key":"amount","label":"金額","type":"Integer","min":0}
      ]}
  ]
}
```

項目の`key`は半角英字から始まる英数字・`_`で、同階層で一意。`id`は定義内で一意。型は`String`、`Text`、`RichText`、`Integer`、`Float`、`Boolean`、`Date`、`DateTime`、`Enum`、`MultiEnum`、`File`、`Image`、`Object`、`Array`、`Table`。

| 項目 | 意味 |
| --- | --- |
| required | 空値を許可しない。Booleanはfalseも有効な値 |
| minLength / maxLength | 文字数。RichTextはタグを除いた文字数 |
| min / max | 数値範囲 |
| minDate / maxDate | ISO日付文字列での範囲 |
| options | Enum/MultiEnumの文字列選択肢、重複不可 |
| minSelections / maxSelections | MultiEnum選択数 |
| requiredWhen | `{ "field":"status", "equals":"完了" }`。ルートの入力値を参照し、型を含めて一致したら必須 |
| section / group | フォーム内の見出し。配列順で表示 |
| description | 入力者向け説明 |
| fields | Object内部・Table列・Object要素Arrayの子項目 |
| itemType | Array要素の型。単純型またはObject、Array/Tableの直接入れ子は未対応（Objectを介して可） |
| default | 単純値の既定値 |
| minItems / maxItems | 配列・表の行数制約 |
| initialRows | 新規データの初期行数。初版上限1000 |
| rowLabel | 画面上の行名 |
| allowAdd / allowDelete / allowDuplicate / allowReorder | 許可フラグ。未指定は許可 |
| businessKey | 表示・運用上のキー列。IDとは独立 |
| uniqueBy | 重複禁止の単一列（指定しないとキー重複検証を行わない） |
| sortBy / sortDirection | 並び順の単一列とasc/desc。手動で整列し、検証時にチェック |

Objectは子項目で構成する。Arrayは全要素を行ラッパーで持ち、単純値を`value`に格納する。TableとObject要素Arrayは列値を行直下に格納する。複合キー・任意式の要素間整合性は今後の拡張。

## Render Definition

```json
{
  "kind":"RenderDefinition","formatVersion":1,"id":"render-1","definitionId":"definition-1",
  "title":"報告書","useTemplate":false,"template":"<h1>{{projectName}}</h1>",
  "blocks":[
    {"id":"b1","type":"heading","text":"事業報告書"},
    {"id":"b2","type":"field","field":"projectName"},
    {"id":"b3","type":"field","field":"summary","appendixAfter":600,"when":{"field":"status","equals":"完了"}},
    {"id":"b4","type":"table","field":"expenses","rowsPerPage":12},
    {"id":"b5","type":"pagebreak"}
  ]
}
```

この例のsummary/statusは対応するDefinitionに定義する必要がある。未定義参照はエラー。

ブロック型は`heading` / `text` / `field` / `table` / `pagebreak`。`field`はルート項目、またはObject内のドット区切りパス。配列内の複数行を直接のドット参照で展開せず、配列全体を`table`ブロックに渡す。

`when`は条件に一致した場合だけブロックを出力。`appendixAfter`は表示文字数が上限を超えた項目を別添へ移し、元位置を別添参照に置換。`rowsPerPage`は表を指定行数で分割し、HTML/Wordでは改ページを挿入する。Excelは基本版では行を順に配置し、PPTXはスライドに分割する。

`useTemplate:true`では`template`内の`{{projectName}}`を文字列としてHTMLエスケープして挿入。Objectのパスを使用できる。任意JS評価・関数呼出・ループ・三重括弧・HTMLの無検査挿入は行わない。安全なHTMLタグだけを残し、scriptやイベント属性・外部読込要素を除去する。テンプレートの記法と参照を検証するが、HTML構文の厳格な妥当性検査は初版の対象外。

HTMLテンプレートはHTML/印刷PDF用。Officeはブロック配置から基本レイアウトで生成し、拡張子だけを変えたHTMLではなくネイティブOffice Open XMLパッケージを生成する。

## Document Data

```json
{
  "kind":"DocumentData","formatVersion":1,"id":"document-1","definitionId":"definition-1",
  "values":{
    "projectName":"窓口改善","budget":100000,
    "expenses":[
      {"_id":"row-immutable-1","_meta":{"origin":null,"createdBy":"担当者","createdAt":"2026-10-14T00:00:00Z","modifiedBy":"担当者","modifiedAt":"2026-10-14T00:00:00Z"},"category":"備品","amount":100000}
    ]
  }
}
```

`values`のキーはDefinitionの項目キーに対応する。数値はJSON number、真偽値はboolean、未入力の単純型は`""`、File/Imageの空値はnull、MultiEnumは文字列配列、Objectはオブジェクト。

Dateは`YYYY-MM-DD`、DateTimeはブラウザのdatetime-localに対応した`YYYY-MM-DDTHH:mm`文字列。タイムゾーン変換は初版で行わない。

すべてのArray/Table行は不変で一意な`_id`を持つ。配列インデックスを同一性判定に使用しない。`_meta.origin`は複製元行ID、未複製はnull。複製ではネストした行もIDを新規生成する。順序は配列順で表現。MultiEnumは選択肢集合であり、業務行としてのIDを持たない。

添付例:

```json
{"id":"attachment-1","name":"note.txt","size":8,"type":"text/plain","content":"data:text/plain;base64,c2FtcGxlCg=="}
```

内容をBase64 data URLで内包。画像はPNG/JPEG/GIF/WebPを許可し、HTMLには安全な画像形式のみ描画。Wordの埋込はPNG/JPEG。添付は1件10MB、JSONは展開後80MBまで。

## Workspaceと履歴

```text
Workspace = {
  kind, formatVersion, id, actor,
  definition: Definition, render: RenderDefinition, data: DocumentData,
  currentBranch: "main", branches: { "main": "snapshot-id" },
  history: [ Snapshot, ... ]
}
Snapshot = {
  id, parents: [parentId, ...], author, createdAt, message,
  comments: [{id, author, createdAt, text}],
  state: { definition, render, data }
}
```

履歴は親参照を持つDAG。通常状態は親1つ、マージ後は親2つ、初期状態は親なし。履歴IDが同じなら状態と親は同じでなければならない。循環参照、参照先のない親、重複IDを取込時に拒否する。コメントは状態への追加情報で、共通IDで重複除去して取込可能。

単独ファイルの`history`は`{currentBranch, branches, nodes}`で、各nodesのstateは当該種類の文書だけを保存する。Definition/Render Definitionの共有にDocument Dataや添付を含めない。独立ファイルの読込は現在のWorkspaceへ新しい変更状態として記録。履歴を含めて派生を持ち寄る場合はWorkspaceを使用する。

## 三者マージ

1. 2派生の共通祖先を親状態とし、Definition/Render Definition/Document Dataを再帰的に比較する。
2. 一方のみの変更、異なるプロパティへの変更は自動統合。
3. IDを持つ配列はIDごとに追加/削除/変更を比較する。IDのない単純配列は値全体で比較。
4. 順序はID間の前後関係を統合する。共通部分列で移動要素を推定し、同じ要素の異なる移動先や循環する順序は競合とする。
5. 同一プロパティの異なる変更、変更対削除、独立追加のID重複などは自動確定しない。
6. 現在の版/修正版/親状態/削除/編集値の採用を選ぶ。複雑な追加・復元・移動・両方統合はJSON編集を使用する。
7. 要件と出力定義の参照・型・必須・行数・全行IDの一意性・業務キー・整列規則等を再検証してから確定する。

監査のmodifiedBy/modifiedAtは同じ値編集に付随するため、それだけの競合にしない。行のcreatedBy/createdAt/originは保持する。順序計算には二乗のコストがあり、大規模配列の最適化は未実装。

## ローカル保存

IndexedDBの`docbench-workspace-v1`へWorkspaceを自動保存し、利用できない場合はlocalStorageを使用。保存失敗は画面へ表示する。入力値は入力確定時に更新する。状態記録前・読込前・マージ前に1世代バックアップを保存し、保存画面から復元できる。Undo/Redoはブラウザの現在セッション内40操作。ファイルの共有・提出は明示的なJSON保存で行う。

## 第三者ライブラリ

ランタイムは以下をvendorに同梱する。初版portable版はすべてをHTMLに内包し、CDNへアクセスしない。

| ライブラリ | 版 | 出典 | ライセンス |
| --- | --- | --- | --- |
| JSZip | 3.10.1 | https://github.com/Stuk/jszip | MIT（同梱LICENSEにMIT/GPLの選択条項） |
| pako | 1.0.11 | https://github.com/nodeca/pako | MIT |
| docx | 9.6.1 | https://github.com/dolanmiu/docx | MIT |
| PptxGenJS | 4.0.1 | https://github.com/gitbrent/PptxGenJS | MIT |
| rJSmin（ビルドのみ） | 1.3.0 | https://github.com/ndparker/rjsmin | Apache-2.0 |

ライセンス本文はvendorに保存し、portableにも内包する。ビルドで既にminify済みのPptxGenJSを再minifyしない（rJSminが扱えないネストしたテンプレートリテラルがあるため）。

## Portableの格納形式

portable/docbench.htmlは実行に必要な全内容を1ファイルに持つ。短いpako展開用スクリプトとローダー以外のJavaScriptは、ライセンス本文とともにJSONへ格納し、gzip + Base64のASCIIデータとして内包する。展開後のプログラムは動的に作ったscript要素のtextContentへ設定するため、プログラム中のHTML文字列をHTMLパーサーへ直接渡さない。

HTML本体とローダーはASCIIのみ。表示用の日本語はHTML数値文字参照またはJavaScriptのUnicodeエスケープで保持する。LF/CRLFの変換を許容し、コピーで圧縮データが欠けたり変化した場合は画面に起動エラーを表示する。展開には同梱pakoを使い、CDN・fetch・eval・CompressionStreamを必要としない。
