# DocBench JSON形式 v1

本仕様は形式別デザイン対応版の実装に対応する。UTF-8 JSONを使用し、共有時は全体をgzipで圧縮できる。ランタイムにはAI機能・外部通信・サーバ処理を持たせない。

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

ブロック型は`heading` / `text` / `field` / `table` / `pagebreak` / `rich`（Word）/ `shape`（PPTX）。`field`はルート項目、またはObject内のドット区切りパス。配列内の複数行を直接のドット参照で展開せず、配列全体を`table`ブロックに渡す。

`when`は条件に一致した場合だけブロックを出力。`appendixAfter`は表示文字数が上限を超えた項目を別添へ移し、元位置を別添参照に置換。`rowsPerPage`は表を指定行数で分割し、HTML/Wordでは改ページを挿入する。Excelは開始セルから配置し、PPTXは指定したスライド内へ配置する。分割で増えた表は次の印刷ページ・スライドへ配置する。

`useTemplate:true`では`template`内の`{{projectName}}`を文字列としてHTMLエスケープして挿入。Objectのパスを使用できる。任意JS評価・関数呼出・ループ・三重括弧・HTMLの無検査挿入は行わない。安全なHTMLタグだけを残し、scriptやイベント属性・外部読込要素を除去する。テンプレートの記法と参照を検証するが、HTML構文の厳格な妥当性検査は初版の対象外。

HTMLテンプレートはHTML/印刷PDF用。Officeは形式別のブロック配置・書式から生成し、拡張子だけを変えたHTMLではなくネイティブOffice Open XMLパッケージを生成する。

### 形式別デザイン

`outputFormat`で設計・出力する形式を先に選ぶ。値は`html` / `docx` / `xlsx` / `pptx` / `pdf`。入力者は定義された形式で出力する。`designs`に形式ごとのレイアウトを独立して保存する。形式を初めて作成するときは互換用ルート`blocks`から要素構成を引き継ぎ、その形式の初期配置を作成する。既存デザインの切替では再変換しない。

```json
{
  "outputFormat": "xlsx",
  "designs": {
    "xlsx": {
      "useTemplate": false,
      "settings": {"sheetName":"報告書","columnWidths":"22,24,24,20","rowHeight":26,"freezeRows":1,"showGridLines":false,"orientation":"portrait","font":"Yu Gothic","fontSize":11},
      "blocks": [
        {"id":"excel-title","type":"heading","text":"事業報告書","layout":{"cell":"B2","span":3,"rowHeight":36},"style":{"fontSize":24,"bold":true,"color":"#196c74","align":"center"}},
        {"id":"excel-budget","type":"field","field":"budget","layout":{"cell":"B5","span":2},"style":{"numberFormat":"#,##0\"円\""}}
      ]
    }
  }
}
```

従来ファイルのルート`blocks` / `template` / `useTemplate`も読込可能。`designs`がない形式の初期構成に使用する。形式別デザインが存在する場合、ルート`blocks`は互換用データとして保持し、参照検証・出力には形式別の要素を使用する。選択中以外のデザインも参照・書式・位置を検証する。各形式内のブロックIDは一意であり、履歴・マージの項目識別に使用する。

共通`settings`は`font`、`fontSize`（pt）、`color`、`accent`。ブロック`style`は`font`、`fontSize`（pt）、`bold`、`italic`、`underline`、`strike`、`color`、`fill`（nullは透明）、`align`（left / center / right / justify）、`valign`（top / middle / bottom）、`border`、`borderWidth`（pt）、`bottomBorder`、`bottomBorderWidth`（pt）、`lineHeight`（倍率）、`spaceBefore/spaceAfter`（pt）、`wrap`、`numberFormat`。罫線色は`#RRGGBB`または`none`。`labelStyle`と`valueStyle`は同じ書式プロパティを使い、項目名・入力値を別々に上書きする。見出しや項目名に暗黙の下線・背景を付けない。文字の下線と段落/セルの下罫線は別設定。色は`#RRGGBB`。`showLabel:false`は項目名の出力を省略する。

| 形式 | 全体の設定 | 要素ごとの設定・出力 |
| --- | --- | --- |
| HTML / PDF | `css`を標準CSSの後へ追加。`useTemplate`と`template` | `cssClass`でCSS対象を指定。テンプレートはclass/idを保持。PDFはブラウザ印刷 |
| Word | `pageSize`（A4/Letter）、`orientation`、`marginTop/Bottom/Left/Right`（mm）、`lineHeight`（倍率）、`header`、`footer`、`pageNumbers` | 段落の`style.spaceBefore/spaceAfter`（pt）、文字揃え、文字書式、表の`headerFill`、`columnWidths`（列幅比率）、`imageWidth`（最大mm）。表見出し行の繰返し・行の分割防止、RichTextの太字・斜体・下線を保持 |
| Excel | `sheetName`、`columnWidths`（Excelの列幅単位、カンマ区切り）、`rowHeight`（pt）、`freezeRows`、`showGridLines`、印刷`orientation`、`headerFill`、`printArea`（例A1:F20） | `layout.cell`（開始セル）、`layout.span`（横結合の列数）、`layout.rowSpan`（縦結合の行数）、`layout.rowHeight`（pt、未指定は折返し量から自動調整）、`style.numberFormat`（Excel数値書式）。項目名を表示すると値は開始セルの右隣。表は開始セルから列を展開。数字は数値セル、文字列は共有文字列、画像はDrawingMLで埋込。重複セル・重複結合は出力エラー |
| PPTX | `width` / `height`（cm）、`background` | `layout.slide`（1始まり）、`x` / `y` / `w` / `h`（cm）、`rotation`（-360〜360度、中心回転）。テキスト・表・画像を指定位置へ配置。表の`headerFill`、`columnWidths`（列幅比率）。長文はテキスト枠に合わせて縮小。`shape`は`rect` / `ellipse` / `line`、fillとborderを指定。表の回転は未対応で検証エラー |

CSSは外部読込・url()・HTMLタグ・式評価を許可しない。HTML成果物はCSPでも外部接続とスクリプト実行を禁止する。フォントは利用するPCにインストールされたものを使う。HTML/PDF以外でHTMLテンプレートを有効にした定義は検証エラー。

### Wordの文章・レイアウト表

`rich`ブロックの`content`は下記の公開ノード構造を保存する。これは入力項目のTableとは別の固定レイアウト表であり、任意の行列と入れ子・結合を使える。二段組に専用構造はない。`text`は互換表示用の固定文字・参照記法で、入力値をコピーしない。成果物生成時に`content`を使う。

```json
{
  "id":"layout-1", "type":"rich",
  "content":{"type":"doc","content":[
    {"type":"table","attrs":{"id":"t-1"},"content":[
      {"type":"tableRow","attrs":{"id":"r-1"},"content":[
        {"type":"tableCell","attrs":{"id":"c-1","colspan":1,"rowspan":1,"colwidth":[200],"border":"none","fill":null,"padding":6,"valign":"top"},"content":[
          {"type":"paragraph","attrs":{"id":"p-1"},"content":[{"type":"text","text":"固定文章","marks":[{"type":"underline"}]}]}
        ]},
        {"type":"tableCell","attrs":{"id":"c-2","colspan":1,"rowspan":1,"colwidth":[120],"border":"none","padding":6},"content":[
          {"type":"paragraph","attrs":{"id":"p-2"},"content":[{"type":"fieldRef","attrs":{"id":"ref-1","field":"projectName","part":"value"}}]}
        ]}
      ]}
    ]}
  ]}
}
```

| ノード・属性 | 内容 |
| --- | --- |
| `doc.content` | 段落・見出し・表・リスト等の配列 |
| `paragraph` / `heading` | `attrs.textAlign`、`lineHeight`、`spaceBefore/spaceAfter`（pt）、`bottomBorder`。headingは`level:1..6` |
| `text` / `hardBreak` | 文字列`text` / 明示改行。`marks`で文字範囲の書式を指定 |
| `marks` | `bold`、`italic`、`underline`、`strike`、`textStyle`。textStyle.attrsは`fontFamily`、`fontSize`（例16pt）、`color`、`backgroundColor` |
| `fieldRef` | `attrs.field`はDefinitionのルートキーまたはObjectのドットパス。`part:value/label`で入力値/項目名を差込。未定義参照は拒否 |
| `table` / `tableRow` | 行配列/セル配列。`tableCell`または`tableHeader`を使う |
| セル属性 | `colspan/rowspan`（1..100）、`colwidth`（列ごとのpx配列）、`fill`（色/null）、`border`（色/none）、`borderWidth`（pt）、`padding`（px）、`valign` |
| セル内content | 段落・見出し・表（入れ子）・リスト等。結合済み領域の重複セルは置かない |
| その他のノード | `bulletList`、`orderedList`（listItem配列）、`listItem`、`blockquote`、`horizontalRule` |

doc/text/hardBreak以外のノードは一意で不変の`attrs.id`を持つ。画面での新規作成・複製・貼付はIDを生成/再生成する。LLMからはIDを明示して渡す。構造は最大5000ノード・入れ子16段まで。セルの重複結合や表の範囲外結合は拒否する。列幅は先頭行を基準に全幅に対する比率へ換算し、Wordのページ余白内へ配置する。見出しセルの行は繰返し行として出力する。

### Excelの固定セルと範囲設定

`designs.xlsx`には`blocks`のほか以下を保存できる。入力項目に対応するセルの値を設計画面で変更せず、DocumentDataを参照する。空白セル・固定文章は編集可能。ブロックに結び付かない文字は`cellValues`、書式は`cellStyles`に保存する。

```json
{
  "cellValues":{"B3":"=文字列として保存","A10":"注記"},
  "cellStyles":{"B3":{"underline":true,"fill":null,"bottomBorder":"#123456"}},
  "cellMerges":[{"id":"merge-1","cell":"B3","span":3,"rowSpan":2}],
  "columnWidths":{"B":28}, "rowHeights":{"3":36}
}
```

`cellStyles`は共通styleのプロパティを使い、該当セルのブロック書式を上書きする。列幅はExcel文字幅単位、行高はpt。独立の結合範囲も不変IDを持つ。値のあるセルを潰す結合・配置や範囲の重複は拒否する。数値は数値セル、固定文字は`=`で始まっても文字列で保存し、式を実行しない。Jspreadsheetの計算式エンジンは配布しない。グリッド編集は500行・100列まで、入力者プレビューは先頭300行・60列まで。保存データと出力にズームや選択範囲は含めない。

### 編集とプレビュー

定義者画面はWordにTiptap、ExcelにJspreadsheet CE、PowerPointにKonvaを使用する。Wordの文章・セルはクリックして直接編集し、移動には左端のつまみを使用する。表の編集ガイドと行列操作欄は出力しない。Excelはセル/範囲のアドレスと内容欄を持ち、書式変更時はグリッドを再作成せず選択を保持する。Word・Excelの用紙・全体書式・要素一覧は「ページ・要素の設定」から開く。操作は上記JSONモデルの変更へ変換し、ライブラリ内部オブジェクト・DOM・Canvas画像を保存しない。1回のドラッグは1回のUndo操作。HTML/PDFはCSSとブロック配置で編集する。入力者のプレビューは読み取り専用HTML。

設定できる文字・背景・罫線・位置を出力へ反映するが、Officeのレイアウトエンジンとは異なる。Wordの自動改ページ・折返し、Excelの複雑な数値書式、PowerPointの文字縮小・表の行高の完全一致は保証しない。「出力して確認」で実ファイルを確認する。出力されたDOCX/XLSX/PPTXは画像化された画面ではなく、編集可能なネイティブ文字・表・図形を含む。

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

内容をBase64 data URLで内包。画像はPNG/JPEG/GIF/WebPを許可し、HTMLには安全な画像形式のみ描画。Officeの埋込はPNG/JPEG。GIF/WebPはブラウザでPNGへ変換して埋め込む（アニメーションは先頭フレーム）。添付は1件10MB、JSONは展開後80MBまで。

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

## 画面モードとURL

`#editor`で編集者画面、ハッシュがないURLで入力者画面を表示する。`?mode=user`付きURLもハッシュがなければ入力者画面になり、`#editor`が優先される。両画面の切替ボタンはURLも更新し、ブラウザの戻る・進む・再読込でもURLに対応するモードへ戻る。画面切替は同じWorkspaceを保持し、入力値や出力定義を書き換えない。モードは表示の切替であり、アクセス権管理ではない。

## ローカル保存

IndexedDBの`docbench-workspace-v1`へWorkspaceを自動保存し、利用できない場合はlocalStorageを使用。保存失敗は画面へ表示する。入力値は入力確定時に更新する。状態記録前・読込前・マージ前に1世代バックアップを保存し、保存画面から復元できる。Undo/Redoはブラウザの現在セッション内40操作。ファイルの共有・提出は明示的なJSON保存で行う。

## 第三者ライブラリ

ランタイムは以下をvendorに同梱する。portable版も別ファイルのvendorを参照し、CDNへアクセスしない。

| ライブラリ | 版 | 出典 | ライセンス |
| --- | --- | --- | --- |
| JSZip | 3.10.1 | https://github.com/Stuk/jszip | MIT（同梱LICENSEにMIT/GPLの選択条項） |
| pako | 1.0.11 | https://github.com/nodeca/pako | MIT |
| docx | 9.6.1 | https://github.com/dolanmiu/docx | MIT |
| PptxGenJS | 4.0.1 | https://github.com/gitbrent/PptxGenJS | MIT |
| Tiptap core / StarterKit / Table / TextStyleKit | 3.32.0 | https://github.com/ueberdosis/tiptap | MIT（使用するProseMirror依存も同梱） |
| Jspreadsheet CE | 5.0.4 | https://github.com/jspreadsheet/ce | MIT |
| jSuites | 5.12.0 | https://github.com/jsuites/jsuites | MIT |
| ExcelJS | 4.4.0 | https://github.com/exceljs/exceljs | MIT |
| Konva | 10.0.12 | https://github.com/konvajs/konva | MIT |
| rJSmin（ビルドのみ） | 1.3.0 | https://github.com/ndparker/rjsmin | Apache-2.0 |

ライセンス本文はvendorに保存し、portableにも内包する。ライブラリは固定版を同梱する。TiptapはMITのコア拡張だけを使用し、商用ページレイアウト機能やAI機能は使用しない。再生成用の依存ロックはscripts/editor-buildにある。

## Portableの格納形式

`portable/docbench.html`にアプリ本体・CSS・仕様書・ライセンスを持ち、第三者JS/CSSは`../vendor/`から読み込む。配置は`配置先/portable/docbench.html`と`配置先/vendor/`。必要な実行ファイル一覧はportable/build-manifest.jsonのruntimeFilesを参照する。HTMLだけ移動すると起動できず、ライブラリ配置の確認エラーを表示する。

アプリJavaScriptをライセンス本文とともにJSONへ格納し、gzip + Base64のASCIIデータとしてHTMLへ内包する。展開後はscript要素のtextContentへ設定するため、プログラム中のHTML文字列をHTMLパーサーへ直接渡さない。HTML本体とローダーはASCIIのみ。日本語はHTML数値文字参照またはJavaScriptのUnicodeエスケープで保持する。LF/CRLF変換を許容し、圧縮データが欠けた場合は起動エラーを表示する。展開は別ファイルのローカルpakoを使い、CDN・fetch・eval・CompressionStreamを必要としない。
