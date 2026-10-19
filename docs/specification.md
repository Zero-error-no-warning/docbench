# DocBench JSON形式 v1

本仕様は型ライブラリ・複数書類・形式別デザイン対応版の実装に対応する。UTF-8 JSONを使用し、共有時は全体をgzipで圧縮できる。ランタイムにはAI機能・外部通信・サーバ処理を持たせない。

## 外部LLMでJSONを作成・修正する手順

本仕様全体を外部LLM（Microsoft Copilot等）へ渡す。既存の書類を修正する場合は、左サイドバーの「項目定義（Definition）」から現在のDefinitionをコピーまたは保存し、出力デザインを修正する場合は「保存・読込」で現在のRenderDefinitionも保存して一緒に渡す。項目定義には共通条件グラフも含まれる。入力値は出力定義へ埋め込まず、参照として指定する。

LLMへの指示例：

> 添付したDocBench JSON仕様と現在のDefinition・RenderDefinitionに従い、指定する書類を作成・修正してください。現在のdefinitionId、既存の書類・項目・ブロック・リッチ文書ノードのIDを維持し、新規要素だけに一意なIDを付けてください。使用する項目はDefinitionに存在するものに限り、未対応の機能や独自プロパティを追加しないでください。各ファイルを部分差分ではなく、読み込める完全なJSONとして返してください。変更したファイルの種類と、読み込む順序も説明してください。

- デザインだけを変更する場合は、`kind:"RenderDefinition"`の完全なJSONを生成する。`definitionId`は現在のDefinitionの`id`と一致させる。`documents[]`と`defaultDocumentId`を指定し、各書類の`outputFormat`に対応する`designs`へ配置・書式を記述する。
- 階層選択は`TreeEnum`と選択肢IDの経路配列を使用する。階層条件は専用の`treeMatch`ノードで記述し、表示名をIDとして扱ったり、ID配列を文字列の固定値へ変換しない。JSONを直接変更する場合は、使用箇所・条件・入力データの経路も同じ選択肢IDに基づいて更新する。
- 型を作成・改訂する場合は、下記の`typeDefinitions`と`typeRef`に従う。型の変更は入力項目・条件・出力定義と一緒に書式全体の履歴で管理する。`schema`を編集し、使用箇所の展開済み構造も一致させる。`type`は基本型のまま、登録型のIDだけを`typeRef`で指定する。型ID・schema内の項目ID・使用箇所の項目IDは維持する。独自の`type:"FiscalYear"`等は作らない。型だけを共有する場合は`kind:"TypeLibrary"`を使う。
- 新しい入力項目や条件ノードが必要な場合は、完全なDefinitionも生成する。`ruleGraph`はDefinitionに置き、出力定義の`generateWhen` / `when`はそのノードを参照する。既存条件を変えずにデザインだけを変える場合、Definitionを書き換える必要はない。
- 新規作成でサンプル入力値も作る場合は、DocumentDataを別の完全なJSONとして生成する。同じDefinitionの`id`を`definitionId`に使い、配列・表の行には`_id`と`_meta`を付ける。
- 新規作成・複数種類の変更では、Definition → RenderDefinition → DocumentData（必要な場合）の順で読み込む。編集者画面の「保存・読込 → JSONを貼り付けて読み込む」へ、JSON本文だけを1種類ずつ貼り付けて読み込む。Markdownのコードフェンスや説明文を入力欄へ含めない。既存内容を置き換えるため、変更対象外の項目・書類も生成JSONに残す。
- Workspaceを生成・修正する場合は、アプリで保存した全体JSONを基にし、`branches`・`currentBranch`・`history`の参照を維持する。新規の出力デザインを作るために履歴や親状態を捏造しない。通常の新規作成は上記の単独ファイルで行い、読込後にアプリから全体Workspaceを保存する。
- 読込時のエラーはメッセージと生成JSONをLLMへ戻して修正する。読込後は画面の検証とプレビュー、Office形式では実ファイルの出力も確認する。仕様に沿うよう依頼しても、LLMの生成結果が必ず正しくなるわけではない。

この文書には完全なファイル例と、属性だけを示す部分例が混在する。部分例やWorkspaceの疑似構造を、そのまま読込用ファイルとして返さない。後述の未実装項目を、記法の工夫だけで実現できる機能として扱わない。アプリ内にLLM呼出し・生成処理は持たせない。

## 共通形式

`kind`は`Definition` / `RenderDefinition` / `DocumentData` / `Workspace`、`formatVersion`は`1`。ルートと定義項目・出力書類・出力ブロックに一意な`id`を持つ。`constructor` / `prototype` / `__proto__`をプロパティ名に使用しない。対応していない版のファイルは自動解釈しない。

## Definition

```json
{
  "kind": "Definition", "formatVersion": 1,
  "id": "definition-1", "title": "報告書", "description": "入力ガイド",
  "fields": [
    {"id":"field-name","key":"projectName","label":"事業名","type":"String","required":true,"maxLength":100,"section":"基本情報","group":"","description":""},
    {"id":"field-budget","key":"budget","label":"予算","type":"Integer","min":0},
    {"id":"field-status","key":"status","label":"状況","type":"Enum","options":["予定","進行中","完了"]},
    {"id":"field-summary","key":"summary","label":"成果概要","type":"Text"},
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

項目の`key`は半角英字から始まる英数字・`_`で、同階層で一意。`id`は定義内で一意。型は`String`、`Text`、`RichText`、`Integer`、`Float`、`Boolean`、`Date`、`DateTime`、`Enum`、`MultiEnum`、`TreeEnum`、`File`、`Image`、`Object`、`Array`、`Table`。

| 項目 | 意味 |
| --- | --- |
| required | 表示されているとき、空値を許可しない。Booleanはfalseも有効な値 |
| minLength / maxLength | 文字数。RichTextはタグを除いた文字数 |
| min / max | 数値範囲 |
| minDate / maxDate | ISO日付文字列での範囲 |
| options | Enum/MultiEnumの文字列選択肢、重複不可 |
| minSelections / maxSelections | MultiEnum選択数 |
| visibleWhen | `{ "field":"kind", "equals":"A" }`。条件に一致する場合だけ、入力・検証・書類出力の対象にする |
| requiredWhen | `{ "field":"status", "equals":"完了" }`。ルートの入力値を参照し、型を含めて一致したら必須 |
| section / group | フォーム内の見出し。配列順で表示 |
| description | 入力者向け説明 |
| fields | Object内部・Table列・Object要素Arrayの子項目 |
| itemType | Array要素の型。単純型またはObject、Array/Table/TreeEnumの直接指定は未対応（Objectを介して可） |
| default | 単純値の既定値 |
| minItems / maxItems | 配列・表の行数制約 |
| initialRows | 新規データの初期行数。初版上限1000 |
| rowLabel | 画面上の行名 |
| allowAdd / allowDelete / allowDuplicate / allowReorder | 許可フラグ。未指定は許可 |
| businessKey | 表示・運用上のキー列。IDとは独立 |
| uniqueBy | 重複禁止の単一列（指定しないとキー重複検証を行わない） |
| sortBy / sortDirection | 並び順の単一列とasc/desc。手動で整列し、検証時にチェック |

Objectは子項目で構成する。Arrayは全要素を行ラッパーで持ち、単純値を`value`に格納する。TableとObject要素Arrayは列値を行直下に格納する。複合キー・任意式の要素間整合性は今後の拡張。

### 型ライブラリと登録型

「型を定義」は要件定義の前に利用できる編集画面。標準の「和暦年度」「和暦年」を用意し、独自の型を構造・規則・表示設定の組合せとして追加できる。基本型16種はそのまま保持する。

Definitionの任意の`typeDefinitions`配列に型を同梱する。各型は`id`、同一ライブラリ内で一意な英字キー`key`、名前`name`、任意の説明`description`、現在の定義`schema`を持つ。型ごとの版番号・公開・下書きの区別は設けない。型定義・入力項目・条件・出力デザインをまとめて書式全体の履歴で管理する。「全体」を保存すると全てとその履歴を保存できる。

`schema`はルートキーを`value`とする通常の入力項目定義。Object・Array・Tableの子項目には基本型に加えて登録済みの型を指定できる。登録型を使う子項目には`typeRef:{id}`と参照型の展開済み構造を持たせ、その内部の子項目には`typeFieldId`を保持する。schemaのルートを別の登録型への参照にはしない。直接・間接の循環参照は禁止し、存在しない型や展開構造の不一致も検証エラーにする。型の定義内には`requiredOverride`・`visibleWhen`・`requiredWhen`を置かず、表示・必須条件は書類の項目側に設定する。子項目の通常の`required`は型に含められる。定義の不備は通常の定義エラーとして表示する。

Arrayの「要素の型」でも登録済みの型を選べる。登録型の配列は既存の行ラッパーを使い、`itemType`には参照先の実際の基本型（String・Enum・Object等）を指定し、`fields:[{key:"value",typeRef:{id},...展開済みの登録型}]`に要素の完全な定義を保持する。fieldsのvalue項目は参照・入力規則を持つ要素スキーマであり、すべての要素をObjectとして扱う意味ではない。編集画面にはこの内部のvalueノードを表示せず、String・Enumなどの要素には子項目追加操作を出さない。参照型の編集は配列側の「要素の型を編集」から行える。各行は`_id`・`_meta`と登録型の値を入れた`value`を持つ。Object型だけでなく、数値・選択型や別の配列型も同じ形式で使う。参照型は`value`項目のtypeRefで表すため、通常の依存関係・循環検証・入力規則・既存値の移行・型ライブラリ保存を適用する。登録型配列の出力は各要素の表示設定を使用する。旧ファイルで登録型配列のitemTypeがObjectに統一されていた場合、読込時に参照要素の実際の型へ修正する。入力値・行ID・項目ID・出力参照は変更せず、Workspace・Definitionの履歴やTypeLibraryにも同じ移行を適用する。

例えば「期間」をObject型とし、開始・終了の子項目のデータ型で登録済みの「和暦年」を選ぶと、両方を同じ型から構成できる。参照元の構造・規則・表示設定の変更は、依存する型と書類の使用箇所へ順に反映する。子項目のキー変更時は既存データ・項目ID・条件・出力参照を維持して移行する。使用数と削除可否には他の型からの使用も含める。型定義の保存は依存先も同梱し、読込時のID衝突で型を複製する場合は依存元のtypeRefも取り込んだ型のIDへ置き換える。

登録型を使用する項目には`typeRef:{id}`を付け、同じDefinitionに含まれる現在のschemaの基本型・構造・規則・表示設定を展開する。ルートの`id`・`key`・`label`・`description`・`section`・`group`・`required`・表示/必須条件は書類の項目固有の設定。型に含まれる子項目には新しい一意な`id`を付け、元のschemaの項目IDを`typeFieldId`に保持する。子項目にも書類固有の表示/必須条件を設定できる。子項目の必須を個別に上書きする場合は`requiredOverride`（真偽値）に同じ値を保存し、`required`へ反映する。条件付き必須は通常の必須をfalseにし、この上書きを保持する。型編集時は明示的な上書き・条件を維持し、上書きのない子項目には型の必須設定を反映する。それ以外の構造がschemaと一致しない場合は検証エラーにする。参照する型がDefinitionにない場合もエラー。標準型も利用・編集時にDefinitionへコピーするため、入力者側で型ライブラリを別途読み込む必要はない。

単純な登録型を含む完全なDefinition例：

```json
{
  "kind":"Definition","formatVersion":1,"id":"definition-types-1","title":"予算入力","fields":[
    {"id":"budget-field","key":"budget","label":"予算額","type":"Integer","required":true,"min":0,"presentation":{"suffix":"円"},"typeRef":{"id":"money-type"}}
  ],
  "typeDefinitions":[
    {"id":"money-type","key":"money","name":"金額","description":"円単位の非負整数","schema":{"id":"money-schema","key":"value","label":"金額","type":"Integer","min":0,"presentation":{"suffix":"円"}}}
  ]
}
```

要件定義のデータ型選択に登録型を表示する。選ぶとその場で使用し、使用版の確認は行わない。「この項目を型として登録」では構造・規則・表示設定をコピーし、その項目で使用する。項目のルート名・必須・条件は維持するが、書類を参照する条件は型のschemaへコピーしない。「通常の項目に展開」で参照を解除し、項目構造と入力値を保持したまま直接編集へ戻せる。

型の編集は、同じ書式内でその型を使用する全項目へ即座に反映する。型内の元項目IDに基づき子項目の識別子を維持し、キーの変更時も値を引き継ぐ。出力・リッチ文書の参照・テンプレート・条件ノード・簡易条件のパスも更新する。追加項目には初期値を入れ、削除項目の値は取り除く。基本型を変えた値は初期値へ戻す（IntegerとFloat間は新しい型でも有効な数値を引き継ぐ）。削除項目への既存参照は検証エラーとして修正する。配列行の`_id`・`_meta`を維持する。型と使用箇所・入力値・参照の変更は一度のUndo/Redoでまとめて戻し、書式全体のスナップショット・派生・マージの対象とする。型だけの公開操作や個別の更新承認はない。

旧形式の`versions`・`draft`・`typeRef.version`を含むファイルは読み込み時に移行する。最新の公開schemaを同じ型IDの定義とし、異なる旧schemaや編集中だったschemaは別のローカル型として保持する。各使用箇所は従来と同じ構造の型を参照し、入力値・項目IDは変更しない。WorkspaceとDefinitionの履歴内も同じ規則で移行する。移行は決定的で、同じ旧ファイルの再読込による差分を作らない。保存する新形式には個別の版番号や下書きを含めない。存在しない旧版の参照はエラーとして残す。

型を登録する機能は入力構造・規則・表示の再利用を対象とする。独自JavaScript、関数によるEnum生成、独自の比較・変換処理、他の登録型へのschema内参照は扱わない。例えば和暦年度全体の前後比較や西暦変換は未実装で、現段階の条件は展開された元号・年数の子項目を参照する。

### TypeLibraryファイル

型だけを別の書式へ持ち込むための追加形式。`{kind:"TypeLibrary",formatVersion:1,typeDefinitions:[...]}`。現在の型schemaだけを含み、書類の入力値・出力デザイン・履歴を含めない。「型を定義 → 型定義を保存」でJSONを出力し、「型定義を読込」でJSON/gzipを追加する。編集者の通常の保存対象からも選べる。JSON貼付け・gzipも通常ファイルと同様に利用できる。

読み込みはこの書式へのローカルコピーとして追加する。既存の項目・入力値・型定義は上書きしない。同じ型IDでschemaが同じなら追加を省略し、schemaが異なる場合は新しい型IDと一意なキーで別の型として追加する。コピー元のIDは任意の`originId`に保持し、同じ内容の再取り込みでは重複を増やさない。型名や説明の差だけでは既存型を変更しない。外部ファイルへの継続的なリンクは作らない。標準型は`source:"standard"`を持つことがあるが、共有後もこの書式内の定義として扱う。

### 階層選択型 TreeEnum

部署など、親子関係を持つ選択肢から1つの経路を選ぶ型。基本型として直接設定でき、「型を定義」で構造・入力方法・出力表示を登録型にまとめることもできる。連動選択のために表示条件を個別に定義する必要はない。

- `options`: `{id,label,children?}`のツリー配列。`id`はツリー内で一意かつ不変の文字列、`label`は1〜200文字。同じ親の子は同名不可、異なる親の下なら同名可。`children`は任意の配列。最大32階層・10000選択肢で、循環・ID重複を検証する。名称・親・並び順を変更してもIDを変えない。
- `leafOnly`: 既定true。trueは末端まで選択、falseは途中の階層でも選択可。
- `treeInput`: `cascade`（既定、階層ごとのプルダウン）または`tree`（検索付きツリー）。親を選び直すと子の選択を解除する。検索は経路全体の表示名を対象とし、実行コードを含まない。
- `presentation.pathDisplay`: `full`（既定、経路全体）または`leaf`（末端名のみ）。`presentation.separator`は経路の区切り（既定` ／ `、40文字以内）。通常のHTML・Word・Excel・PowerPoint・PDFプレビュー・テンプレート・Wordリッチ文書の参照で共通の表示を使う。
- 入力値と任意の`default`は、根から選択先までの選択肢IDの配列。未入力は`[]`。例：表示`A ／ B`は`["dept-a","dept-ab"]`。別の`D ／ B`は`["dept-d","dept-db"]`。名前・配列位置で同一性を判定しない。MultiEnumの複数選択とは異なる。

完全なDefinitionと入力値の例：

```json
{
  "kind":"Definition","formatVersion":1,"id":"definition-tree-1","title":"部署選択",
  "fields":[{
    "id":"department-field","key":"department","label":"担当部署","type":"TreeEnum","required":true,
    "options":[
      {"id":"dept-a","label":"A","children":[{"id":"dept-ab","label":"B"},{"id":"dept-ac","label":"C"}]},
      {"id":"dept-d","label":"D","children":[{"id":"dept-db","label":"B"},{"id":"dept-de","label":"E"}]}
    ],
    "leafOnly":true,"treeInput":"cascade","presentation":{"pathDisplay":"full","separator":" ／ "}
  }]
}
```

```json
{"kind":"DocumentData","formatVersion":1,"id":"data-tree-1","definitionId":"definition-tree-1","values":{"department":["dept-d","dept-de"]}}
```

画面ではツリーの直接編集に加え、タブ字下げによる一括編集を使用できる。1行1選択肢、行頭のTab1つを1階層とし、空行は無視する。行頭の空白による字下げ、親のない階層飛び、同じ親の下の同名選択肢は行番号付きのエラーにする。

```text
A
	B
	C
D
	B
	E
```

テキストは編集画面内の一時入力で、適用前にはDefinitionを変更せず、適用時に通常の`options`へ変換する。JSONの新しい保存形式は追加しない。通常の行編集では内部に保持した行ID、既存の同一経路、同名候補が一意な移動を使って既存IDを保持する。対応付けられない一括変更を無理に推測せず、追加・削除の件数として表示する。削除された選択肢を参照する値や条件は従来どおり保持して検証する。

外部編集用のID付き表示では、選択肢名の後ろにTabと`#"選択肢ID"`を付ける。IDはJSON文字列。例えば`B<Tab>#"dept-ab"`のIDを残せば、名前と親を一括変更しても同一選択肢として扱う。名前に改行・Tab・前後空白・先頭の引用符がある場合は名前もJSON文字列で記述する。明示IDの重複や空IDはエラー。明示されていない新しい選択肢IDはシステムが付与する。IDは表示名として出力しない。編集中に別操作で選択肢の定義が変わった場合、古いテキストの適用を止め、最新定義の読み直しを案内する。

存在しない経路・親子が連続しない経路・型不一致・末端必須なのに途中までの選択は入力エラー。非表示の項目は通常どおり入力検証の対象外。選択肢の移動は有効な入力経路の末端IDに基づいて追従し、同じ項目を参照する階層条件の経路も更新する。削除された選択肢の入力値・条件は保持し、検証で選び直しを促す。登録型の編集では同じ書式内の全使用箇所へ反映し、Undo・履歴でまとめて戻せる。

Object内とTable列、Object要素のArray内でも使用できる。単純要素Arrayの`itemType:"TreeEnum"`は使わず、選択肢設定を持つTreeEnumの子項目をObject内に定義する。

階層の判定は条件グラフの専用ノードを使う。通常の`field`/`literal`/`compare`でID配列を文字列として比較しない。

```json
{"id":"department-match","type":"treeMatch","field":"department","path":["dept-a"],"operator":"descendant","position":{"x":40,"y":60}}
```

`operator:"eq"`は経路全体の一致、`"descendant"`は指定経路自身とその配下（経路の接頭辞）の判定。未入力・不完全・無効な入力や非表示の参照元は未確定になる。判定経路は途中階層でも指定できるが、存在しない経路・配列内の項目参照は定義エラー。出力ポート`result`はBooleanで、AND/OR/NOT・表示・必須・書類生成・出力要素の条件へ共通に接続できる。入力ポートはない。条件の依存・表示循環・未定義参照も通常の検証対象になる。

簡易条件には`{field:"department",equals:["dept-a"],operator:"descendant"}`を使用でき、`operator`省略時は`eq`。画面のノード編集を開くと`treeMatch`へ変換する。通常の項目設定の条件選択からも経路を選べる。TreeEnumを含むファイルは、この型に対応する版のDocBenchで開くこと。

### 複合入力と表示設定

`presentation`は任意の表示設定。Objectの子項目を横並びにしたり、数値に単位・表示名を付けられる。値の型や条件判定の意味は変わらない。

| 設定 | 対象・意味 |
| --- | --- |
| layout | Object。`stacked`（既定・縦並び）または`inline`（横並び・幅不足時に折返し） |
| hideChildLabels | Object。子項目の表示名を隠す。入力欄のアクセシブル名は保持 |
| separator | Objectのinline出力で子項目をつなぐ文字列。既定は空文字、最大40文字 |
| prefix / suffix | String / Text / Integer / Float / Date / DateTime / Enum。入力欄・成果物の前後に表示する文字列。各100文字以内。保存値には含めない |
| valueLabels | Integer / Float。保存する数値と表示名の対応。例：`{"1":"元"}`。100件以内 |

表示名のキーは項目の型・範囲に一致する有限数値の標準文字列（`1`は可、`01`は不可）。表示名は前後空白なし・重複なしの1〜100文字とし、別の数値に見える名前は不可。表示名がある数値欄では、数値・表示名のどちらを入力しても数値として保存する。未入力は空文字のままで0にはしない。不正な入力は検証エラーとなる。

和暦の「年だけ」を入力する例（項目定義の断片）：

```json
{
  "id":"year-only","key":"targetYear","label":"対象年","type":"Object",
  "presentation":{"layout":"inline","hideChildLabels":true,"separator":""},
  "fields":[
    {"id":"year-era","key":"era","label":"元号","type":"Enum","options":["令和","平成","昭和","大正","明治"],"default":"令和","required":true},
    {"id":"year-number","key":"year","label":"年数","type":"Integer","min":1,"required":true,"presentation":{"suffix":"年","valueLabels":{"1":"元"}}}
  ]
}
```

入力データは`{"targetYear":{"era":"令和","year":1}}`、表示は「令和元年」。元年の保存値は1であり、0は最小値制約でエラーにする。年数は初期値を持たず、未入力と元年を区別する。要件定義では、空のObjectを選び「入力・表示」→「和暦年の設定例を使う」で同じ定義を作れる。元号一覧や表示名は通常の設定として変更できる。日付型への変換、西暦との変換、各元号の実在年範囲の検証、関数によるEnum生成は行わない。

inlineの成果物出力は、表示対象の子項目を定義順に連結する。空値の子項目は単位ごと省略し、全子項目が空なら`—`。表示名・前後の文字列はHTML / Word / Excel / PowerPoint / PDFプレビューへ反映する。Excelでは表示名に該当する数値、または接頭辞・接尾辞がある数値は表示文字列として出力する。それ以外の数値セルは数値のまま。Document Dataと条件判定は常に元の型・数値を使う。

### 条件による入力項目の切替

```json
{
  "fields": [
    {"id":"kind-field","key":"kind","label":"種別","type":"Enum","options":["A","B"],"required":true},
    {"id":"x-field","key":"x","label":"項目X","type":"String","required":true,"visibleWhen":{"field":"kind","equals":"A"}}
  ]
}
```

種別Aでは項目Xを表示し必須にする。Bでは項目Xを表示しない。Definitionの項目構造は維持し、その入力値に対する有効な項目の集合を計算する。表示条件なしは常に表示する。`requiredWhen`は表示とは独立で、表示されている項目だけに適用する。旧ファイルで両方が指定されている場合は`required:true`を優先する。画面では常時必須または条件付き必須のどちらかを設定する。

上記は互換用の単一等値比較の記法。複合条件は後述の共通条件グラフを使う。参照元はルートまたはObject内のString/Text/Integer/Float/Boolean/Date/DateTime/Enum/TreeEnum。TreeEnumは上記の階層判定を使う。配列内の各行・複合型は条件元に使用しない。Enum値は定義済み選択肢、Boolean値はtrue/false、数値は数値型で指定する。画面では項目を選び、Enumは選択肢、Booleanははい/いいえ、数値・日付は対応する入力欄で設定する。AND/OR/NOT・大小比較はノードエディタに対応し、行ごとの条件は未実装。

Object・Array・Table全体や内部の項目にも`visibleWhen`を設定できる。親が非表示なら子も非表示。表の条件付き列は全行共通の条件で列全体を切り替える。非表示の条件元の保存値は条件評価に使わず、依存項目も非表示になる。表示条件の自己参照・相互参照・親子間の循環を検証する。未定義項目・対応外の型・等値の型不一致も定義エラー。

非表示中は必須・型・範囲・選択・要素数の入力検証を行わない。非表示の列を使う重複・並び順制約は適用しない。条件が再び一致すると保存値を復元し、検証も再開する。未知のルート項目は非表示とはみなさず未定義項目として検証する。

入力値・添付・行IDは非表示になっても削除しない。Document Data、Workspace、履歴、Undo/Redo、JSON/gzipには非表示の値も保持する。JSONから値を除去する機能やアクセス制御ではない。現在有効な値は`DocBench.inputState(definition, values).values()`、有効な項目定義は`.definition()`で取得できる。これらはコピーを生成し、元データを変更しない。`visible(path)`は親条件も含む表示可否、`required(field)`は必須判定、`matches(condition)`は共通の条件判定。

書類のfield/tableブロックは非表示項目を出力せず、Object・表の内部も非表示項目を除外する。HTMLテンプレートの非表示参照とWordのリッチ文書内の値・ラベル参照は空文字になる。固定文章や手書きのラベルは自動削除しない。HTML・Word・Excel・PPTX・印刷PDFおよびプレビューで同じ条件を使い、複数書類でも同じ入力状態を共有する。書類出力定義のブロック`when`も非表示の条件元の値では成立しない。

入力変更で表示・必須の状態が変わったときに入力欄を更新し、操作中の入力欄のフォーカス・カーソルとスクロール位置を可能な範囲で維持する。表示状態が変わらない通常の入力では入力欄を作り直さない。

## 共通条件グラフとノードエディタ

表示・必須・出力ブロック・書類生成の条件は、Definitionの`ruleGraph`を共通に参照できる。条件の指定は`{"nodeId":"条件結果のノードID"}`。適用先ごとの入力は1つで、複数条件を使うときはAND/OR/NOTノードで明示して合成する。同じ結果は複数の適用先へ接続できる。

次は「（種別AまたはB）かつ（金額が1,000以上）」で項目Xを表示・必須にする完全なDefinition例。

```json
{
  "kind":"Definition","formatVersion":1,"id":"definition-rules","title":"条件付き書類",
  "fields":[
    {"id":"field-kind","key":"kind","label":"種別","type":"Enum","options":["A","B","C"],"required":true},
    {"id":"field-amount","key":"amount","label":"金額","type":"Integer","min":0},
    {"id":"field-x","key":"x","label":"項目X","type":"String","visibleWhen":{"nodeId":"eligible"},"requiredWhen":{"nodeId":"eligible"}}
  ],
  "ruleGraph":{
    "nodes":[
      {"id":"kind-value","type":"field","field":"kind","position":{"x":40,"y":40}},
      {"id":"a","type":"literal","valueType":"string","value":"A","position":{"x":40,"y":220}},
      {"id":"b","type":"literal","valueType":"string","value":"B","position":{"x":40,"y":400}},
      {"id":"is-a","type":"compare","operator":"eq","position":{"x":350,"y":40}},
      {"id":"is-b","type":"compare","operator":"eq","position":{"x":350,"y":250}},
      {"id":"a-or-b","type":"or","position":{"x":660,"y":40}},
      {"id":"amount-value","type":"field","field":"amount","position":{"x":40,"y":600}},
      {"id":"minimum","type":"literal","valueType":"number","value":1000,"position":{"x":40,"y":780}},
      {"id":"large-enough","type":"compare","operator":"gte","position":{"x":350,"y":600}},
      {"id":"eligible","type":"and","label":"生成対象","position":{"x":970,"y":250}}
    ],
    "connections":[
      {"id":"c1","source":"kind-value","target":"is-a","input":"left"},
      {"id":"c2","source":"a","target":"is-a","input":"right"},
      {"id":"c3","source":"kind-value","target":"is-b","input":"left"},
      {"id":"c4","source":"b","target":"is-b","input":"right"},
      {"id":"c5","source":"is-a","target":"a-or-b","input":"items"},
      {"id":"c6","source":"is-b","target":"a-or-b","input":"items"},
      {"id":"c7","source":"amount-value","target":"large-enough","input":"left"},
      {"id":"c8","source":"minimum","target":"large-enough","input":"right"},
      {"id":"c9","source":"a-or-b","target":"eligible","input":"items"},
      {"id":"c10","source":"large-enough","target":"eligible","input":"items"}
    ],
    "targetPositions":{}
  }
}
```

`nodes`と`connections`は不変・一意なIDを持ち、履歴・差分・三者マージはIDで比較する。ノードIDの`target:`/`binding:`接頭辞、および接続IDの`binding:`接頭辞は画面用の予約領域。上限は500ノード・1500接続。ノードの任意名は`label`、位置は`position:{x,y}`。位置を省略して読み込める。位置は論理評価に影響しない。

| type | 設定 | 入力ポート | 出力 |
| --- | --- | --- | --- |
| field | `field`はDefinition内のドットパス | なし | 項目の値 |
| literal | `valueType`と`value` | なし | 固定値 |
| compare | `operator` | `left`と`right`にそれぞれ1本 | 条件結果 |
| treeMatch | TreeEnumの`field`、ID経路`path`、`operator: eq / descendant` | なし | 経路一致・自身と配下の判定結果 |
| and | 任意の`label` | `items`に1本以上、複数可 | すべて成立なら成立 |
| or | 任意の`label` | `items`に1本以上、複数可 | いずれか成立なら成立 |
| not | 任意の`label` | `value`に1本 | 成立と不成立を反転 |

保存形式では各ノードの出力は1つで、接続の`source`にノードID、`target`に接続先ノードID、`input`に入力ポート名を指定する。Rete画面上の出力ポート名は`result`。Boolean型の項目や固定値は直接AND/OR/NOT・適用先へ接続できる。

`field`の参照元は配列外のString/Text/Enum/Integer/Float/Boolean/Date/DateTime。String/Text/Enumの型は`string`、Integer/Floatは`number`として評価する。`literal.valueType`は`string` / `number` / `boolean` / `date` / `datetime`。`value`は対応するJSONの文字列・数値・真偽値。比較の左右は同じ型を使い、自動で文字列と数値を変換しない。

`operator`は`eq`（等しい）/ `ne`（等しくない）/ `gt`（より大きい）/ `gte`（以上）/ `lt`（より小さい）/ `lte`（以下）。等値は型を含むJSON値で比較する。大小比較は数値・日付・日時に限定し、日付・日時は有効なISO値を時刻に変換して比較する。

評価結果は`{status:"known",value,valueType}`または`{status:"unknown",reason}`。参照先が非表示、値が未入力・型不一致、入力ポートが未接続なら未確定。空のEnum・数値・日付は未入力で、Stringの空文字は比較可能。Booleanのfalseと数値の0は入力済みとして扱う。NOTの入力が未確定なら結果も未確定。ANDは1つでも不成立なら不成立、ORは1つでも成立なら成立。それ以外で未確定の入力が残る場合は結果も未確定。適用先はBoolean型の成立（true）だけを採用する。

出力のない作業ノードは未接続のまま保存できる。適用先が参照している条件の必要入力が未接続なら定義エラー。ノード・接続のID重複、存在しない参照、入力ポートの重複、値と条件の接続間違い、比較型の不一致、グラフの循環、項目の表示条件を経由した循環も検証する。

項目は`visibleWhen` / `requiredWhen`、書類は`generateWhen`、出力ブロックは`when`で条件結果を参照する。適用先はグラフのノード配列へ保存せず、それぞれの項目・書類・ブロックのプロパティへ保存する。Reteでは適用先のノードを生成して表示する。適用先の位置は`ruleGraph.targetPositions`に画面IDをキーとして保存し、参照対象が現在のファイルにない位置情報は無視する。

`requiredWhen`をノードで接続すると`required`をfalseにして、接続された結果だけで必須を決める。「入力必須」をオンにすると`requiredWhen`を解除して常に必須にする。読み込み互換用に`required:true`と条件が共存するファイルでは常に必須を優先する。

書類生成条件の例（対応するDefinitionは上のグラフを含むものを使用）：

```json
{
  "kind":"RenderDefinition","formatVersion":1,"id":"render-rules","definitionId":"definition-rules",
  "defaultDocumentId":"report",
  "documents":[
    {"id":"report","title":"対象報告書","outputFormat":"docx","generateWhen":{"nodeId":"eligible"},"designs":{"docx":{"blocks":[{"id":"title","type":"heading","text":"対象報告書"}]}}},
    {"id":"appendix","title":"補助書類","outputFormat":"html","generateWhen":{"nodeId":"a-or-b"},"designs":{"html":{"blocks":[{"id":"appendix-title","type":"heading","text":"補助書類"}]}}}
  ]
}
```

`generateWhen`なしは常に生成候補。複数成立ならすべて候補に含め、排他的な選択とはしない。入力変更で候補を再評価し、選択中の書類が候補外になれば既定または先頭の候補へ切り替える。候補が0件なら出力ボタンを無効にする。編集者は条件不成立のデザインも編集でき、出力は成立時に行う。`DocBench.availableDocuments(definition,render,values)`で候補一覧、`canGenerate(definition,document,values)`で単一書類の可否を得る。低レベルの各形式レンダラーはプレビューにも使うため、生成対象の選択は呼出側で行う。

PCの共通画面は右半分を編集・プレビュー専用とし、書類名・保存・履歴を持つヘッダーを左半分の上に固定する。工程選択と設定・書式操作はヘッダーの下に配置する。型・要件・条件・出力・入力の切替でも左右の境界を変えず、右側は画面の上端から下端まで確保する。Wordへの切替時にヘッダーを移動しない。出力設計の書類選択・追加・管理は左の「書類の切替・管理」から開く。書類全体の名前・入力者への説明は、上部の書類名の横にある「書類名・説明」から編集する。編集者画面の全工程から開け、入力項目の設定とは分ける。入力者画面ではこの編集ボタンを表示しない。工程選択、作成者・派生、画面モード切替、Definition・出力定義仕様への入口はサイドバーへ配置する。PCでは作業領域をブラウザの高さへ収め、長い設定・項目一覧・入力・プレビューを各ペイン内でスクロールする。画面全体の重複タイトルは表示しない。サイドバーの開閉は編集データや履歴を変更せず、ブラウザの一時設定として保持する。狭い画面ではサイドバーを重ねて開き、作業領域内でペインを縦にスクロールできる。

「条件を設計」画面ではRete.jsのノード・接続・移動・拡大縮小を使用する。右ペインで項目・固定値・比較方法・名前・接続を編集し、判定理由を表示する。端子から端子への接続と、右ペインの選択操作での接続に対応する。整列・全体表示・接続解除・削除、全体のUndo/Redo、JSON/gzip、自動保存・履歴に対応する。入力項目ノードのサンプル値はDocument Dataを編集し、Definitionへ入力値や判定結果を保存しない。

ノード名の検索は画面上のノード名・適用先名を対象に、部分一致で行う（英字の大小文字・全角半角を正規化）。一致ノードを強調し、結果の選択または上下キーとEnterでノード中央へ移動する。Escape・解除ボタンで検索を解除する。ミニマップはノード名と接続線を表示し、端子・入力欄・判定内容を省略する。長い名前は省略表示し、ホバー時に全文を表示する。名前のクリックで選択・移動、背景のクリック・ドラッグと表示範囲枠のドラッグで移動できる。追加・改名・削除・移動・接続・Undo/Redo・表示サイズの変更に追従する。ミニマップは折りたため、全体表示は開いたミニマップに重ならない範囲に収める。検索と表示範囲は編集画面の一時状態で、Definition / Render Definition / Document Data・変更履歴には保存しない。

簡易条件UIも同じグラフを作成する。非共有の単一比較はIDを保って更新し、共有条件の一方だけを簡易UIで変更する場合は新しい比較へ分ける。ノード画面で共有元を変更した場合はすべての適用先へ反映する。複合条件は簡易UIに単一比較として展開せず「複合条件をノードで編集」から開く。

旧形式`{field,equals}`も引き続き読み込み・評価できる。ノード画面を開く際、対応する単純型条件を決定的なIDの項目・固定値・等値比較へ変換する。既存の履歴ノードは書き換えない。旧出力条件の複合型比較など、変換対象外の条件は保持する。新規の条件はグラフ参照を推奨する。グラフ参照を含むファイルはこの拡張対応版で開くこと。

ruleGraphはDefinitionに保存するため、Render Definitionの条件を編集した場合も対応するDefinitionと組で共有する。Workspaceなら両方をまとめて保存できる。外部LLMは本仕様のJSONを生成でき、アプリ自体にAI機能や任意JavaScriptの評価機能は持たせない。計算ノード・配列行ごとの条件・条件付き書式・図形生成・一括ZIP出力は未実装。

## Render Definition

1つのRender Definitionに複数の出力書類を保持する。DefinitionとDocument Dataは共通で、書類ごとに名前・出力形式・デザインを持つ。

```json
{
  "kind":"RenderDefinition","formatVersion":1,"id":"render-1","definitionId":"definition-1",
  "title":"事業提出書類","defaultDocumentId":"document-report",
  "documents":[
    {
      "id":"document-report","title":"事業報告書","outputFormat":"docx",
      "designs":{"docx":{"useTemplate":false,"settings":{"pageSize":"A4"},"blocks":[
        {"id":"b1","type":"heading","text":"事業報告書"},
        {"id":"b2","type":"field","field":"projectName"},
        {"id":"b3","type":"field","field":"summary","appendixAfter":600,"when":{"field":"status","equals":"完了"}},
        {"id":"b4","type":"table","field":"expenses","rowsPerPage":12}
      ]}}
    },
    {
      "id":"document-budget","title":"予算明細","outputFormat":"xlsx",
      "designs":{"xlsx":{"useTemplate":false,"settings":{"sheetName":"予算明細"},"blocks":[
        {"id":"budget-title","type":"heading","text":"予算明細","layout":{"cell":"A1","span":3}},
        {"id":"budget-table","type":"table","field":"expenses","layout":{"cell":"A3","span":3}}
      ]}}
    }
  ]
}
```

`documents`は1件以上。書類の`id`はRender Definition内で一意かつ不変で、配列位置・書類名を同一性判定に使わない。書類名は空欄不可、同名は許可。`defaultDocumentId`は存在する書類のIDを指定し、新しく画面を開くときの選択に使用する。ルートの`title`は出力定義全体の名称、各書類の`title`は成果物のタイトル・ファイル名に使用する。

編集者は書類の追加・切替・複製・削除・既定の指定を行える。新規書類は出力形式を選んで空のデザインから開始する。複製は全形式のデザインを深くコピーし、書類・ブロック・リッチ文書ノード・セル結合のIDを再発行する。項目参照は共通Definitionを引き続き参照する。最後の1件は削除できない。既定の書類を削除すると残りの先頭を既定にする。入力値・添付は書類の削除でも保持する。

入力者は書類を選択してプレビュー・個別出力する。編集者と入力者の選択中の書類IDは画面内の状態であり、JSONや履歴へ保存しない。選択操作はUndo対象にしない。書類の追加・編集・複製・削除・既定の指定はUndo/Redo・スナップショット・差分・派生・三者マージの対象。異なる書類への変更はID単位でマージする。

全書類と保持している全形式のデザインを参照・配置・書式検証する。未選択の書類も不正な定義を含む場合は読込・出力を止める。不要項目の警告は全書類・全形式での利用をまとめて判定する。書類の生成条件は共通条件グラフで設定する。一括生成は未実装。

### 単一書類ファイルとの互換性

`documents`がない従来のRender Definitionは、ルートの`title`・`outputFormat`・`blocks`・`template`・`useTemplate`・`css`・`settings`・`designs`などを1件の書類へ移す。書類IDは旧Render Definitionの`id`に`_document`を付けた値とし、既定もそのIDとする。Workspace内の全履歴、および単独Render Definitionの履歴内のstateも同じ規則で変換するため、同じ旧ファイルを別々に読み込んでも履歴の同一性が保たれる。既存のブロックID・デザイン・値は保持する。`documents`があるファイルの不正なIDや既定値は自動修復せず検証する。

`formatVersion`は1を継続するが、複数書類を保存したファイルはこの拡張に対応したDocBenchで開くこと。従来版への逆変換は行わない。

この例は最初のDefinition例（`definition-1`）と組み合わせて使用できる。`summary` / `status`を含め、すべての参照項目を対応するDefinitionに定義する。未定義参照はエラー。

ブロック型は`heading` / `text` / `field` / `table` / `pagebreak` / `rich`（Word）/ `shape`（PPTX）。`field`はルート項目、またはObject内のドット区切りパス。配列内の複数行を直接のドット参照で展開せず、配列全体を`table`ブロックに渡す。

`when`は条件に一致した場合だけブロックを出力。`appendixAfter`は表示文字数が上限を超えた項目を別添へ移し、元位置を別添参照に置換。`rowsPerPage`は表を指定行数で分割し、HTML/Wordでは改ページを挿入する。Excelは開始セルから配置し、PPTXは指定したスライド内へ配置する。分割で増えた表は次の印刷ページ・スライドへ配置する。

`useTemplate:true`では`template`内の`{{projectName}}`を文字列としてHTMLエスケープして挿入。Objectのパスを使用できる。任意JS評価・関数呼出・ループ・三重括弧・HTMLの無検査挿入は行わない。安全なHTMLタグだけを残し、scriptやイベント属性・外部読込要素を除去する。テンプレートの記法と参照を検証するが、HTML構文の厳格な妥当性検査は初版の対象外。

HTMLテンプレートはHTML/印刷PDF用。Officeは形式別のブロック配置・書式から生成し、拡張子だけを変えたHTMLではなくネイティブOffice Open XMLパッケージを生成する。

### 形式別デザイン

各`documents[]`の`outputFormat`で設計・出力する形式を先に選ぶ。値は`html` / `docx` / `xlsx` / `pptx` / `pdf`。入力者は定義された形式で出力する。`designs`に形式ごとのレイアウトを独立して保存する。形式を初めて作成するときは書類内の初期構成用`blocks`から要素構成を引き継ぎ、その形式の初期配置を作成する。既存デザインの切替では再変換しない。

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

従来ファイルのルート`blocks` / `template` / `useTemplate`は書類内へ移して読込可能。`designs`がない形式の初期構成に使用する。形式別デザインが存在する場合、書類内の`blocks`は新しい形式の初期構成用データとして保持する。出力には形式別の要素を使用し、初期構成と全デザインを参照検証する。選択中以外のデザインも参照・書式・位置を検証する。各形式内のブロックIDは一意であり、履歴・マージの項目識別に使用する。

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
| `marks` | `bold`、`italic`、`underline`、`strike`、`subscript`、`superscript`、`textStyle`。textStyle.attrsは`fontFamily`、`fontSize`（例16pt）、`color`、`backgroundColor` |
| `fieldRef` | `attrs.field`はDefinitionのルートキーまたはObjectのドットパス。`part:value/label`で入力値/項目名を差込。未定義参照は拒否 |
| `table` / `tableRow` | 行配列/セル配列。`tableCell`または`tableHeader`を使う |
| セル属性 | `colspan/rowspan`（1..100）、`colwidth`（列ごとのpx配列）、`fill`（色/null）、`border`（色/none）、`borderWidth`（pt）、`borders`（下記）、`padding`（px）、`valign` |
| セル内content | 段落・見出し・表（入れ子）・リスト等。結合済み領域の重複セルは置かない |
| `listItem.attrs.markerColor` | 任意の記号・番号の文字色（#RRGGBB）。未指定は最初の段落の先頭文字、次に全体書式から継承。HTMLとWordの段落記号の書式へ反映 |
| `listItem.attrs.markerFontSize` | 任意の記号・番号サイズ（pt、1..1000）。未指定は最初の段落の先頭文字、次に全体書式から継承。HTMLとWord出力で反映 |
| その他のノード | `bulletList`、`orderedList`（listItem配列）、`listItem`、`blockquote`、`horizontalRule` |

セルの`attrs.borders`は任意の辺ごとの上書き。`top/right/bottom/left`に`"none"`または`{"color":"#172b39","width":0.5,"style":"single"}`を指定する。widthは0.1..10pt、styleは`single/dashed/dotted/double`。省略した辺は従来のborder/borderWidthを使う。画面とDOCXは同じ辺属性を使う。外枠/内側/すべて/なしのプリセットは対象内の4辺を設定し直す。辺指定は該当する辺だけを変更する。対象は表全体または選択セルの矩形。入れ子の場合はカーソルのある内側の表が対象。罫線は結合セルの辺単位で設定し、辺の途中に分割した罫線は設定しない。セル内余白や縦位置の変更で罫線を変更しない。

orderedListの`attrs.start`（省略時1）は開始番号。番号はDOCXのネイティブ番号定義として出力し、手入力した番号文字ではない。

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

要件定義の再描画では、同じDefinitionの項目一覧・フォームプレビュー・ページのスクロールを保持する。同じ項目の編集では設定欄の開閉状態と入力欄のフォーカス・文字選択も保持する。別のDefinitionへの切替にこれらを引き継がない。表示状態はJSONに保存しない。

定義者画面はWordにTiptap、ExcelにJspreadsheet CE、PowerPointにKonvaを使用する。Wordの文章・セルはクリックして直接編集し、移動には左端のつまみを使用する。PCでは左に独立スクロールの操作ペイン、右に文書ペインを置き、表/セル操作やメニューの表示切替で文書の位置・表示領域を変更しない。狭い画面では固定高の操作領域を上に置く。入力は編集インスタンスを維持して保存し、再描画が必要な変更ではカーソル/文字・セル選択/入力待ちの書式/文書スクロールを引き継ぐ。これらの表示状態はJSONに保存しない。文字/段落/挿入のツールバーを常時表示し、文字選択と書式ボタンの状態を同期する。書式入力へフォーカスを移しても文字選択と表示を保持し、文字サイズの連続入力で本文へフォーカスを奪わない。Enterで本文へ戻す。選択中のリスト項目の記号・番号にも文字サイズ・文字色を反映し、子リストの変更で親の記号を変更しない。見出し、リスト、リスト階層、上下付き文字、書式解除、編集履歴を操作できる。入力項目は編集中のカーソル位置（セル内を含む）へ参照として挿入する。固定レイアウト表はマス目または行列数で挿入し、表を選択すると行列・結合・セル設定・罫線の操作欄が表示される。表の編集ガイドと行列操作欄は出力しない。Excelはセル/範囲のアドレスと内容欄を持ち、書式変更時はグリッドを再作成せず選択を保持する。Word・Excelの用紙・全体書式・要素一覧は「ページ・要素の設定」から開く。操作は上記JSONモデルの変更へ変換し、ライブラリ内部オブジェクト・DOM・Canvas画像を保存しない。1回のドラッグは1回のUndo操作。HTML/PDFはCSSとブロック配置で編集する。入力者のプレビューは読み取り専用HTML。

設定できる文字・背景・罫線・位置を出力へ反映するが、Officeのレイアウトエンジンとは異なる。Wordの自動改ページ・折返し、Excelの複雑な数値書式、PowerPointの文字縮小・表の行高の完全一致は保証しない。「出力して確認」で実ファイルを確認する。出力されたDOCX/XLSX/PPTXは画像化された画面ではなく、編集可能なネイティブ文字・表・図形を含む。

## Document Data

```json
{
  "kind":"DocumentData","formatVersion":1,"id":"document-1","definitionId":"definition-1",
  "values":{
    "projectName":"窓口改善","budget":100000,"status":"完了","summary":"窓口の案内を改善しました。",
    "expenses":[
      {"_id":"row-immutable-1","_meta":{"origin":null,"createdBy":"担当者","createdAt":"2026-10-14T00:00:00Z","modifiedBy":"担当者","modifiedAt":"2026-10-14T00:00:00Z"},"category":"備品","amount":100000}
    ]
  }
}
```

`values`のキーはDefinitionの項目キーに対応する。数値はJSON number、真偽値はboolean、未入力の単純型は`""`、File/Imageの空値はnull、MultiEnumは文字列配列、Objectはオブジェクト。

入力項目の`RichText`は許可されたHTMLの文字列として保存する。Word出力設計の`rich.content`は公開ノードJSONであり、入力値のRichTextとは別形式。LLMは入力値へTiptap JSONを入れたり、`rich.content`へHTML文字列を入れたりしない。

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

### 空の新規書類

編集者の「新規書類」は新しいWorkspace・Definition・RenderDefinition・DocumentData・出力書類のIDを作る。入力項目と入力値、独自型、条件、出力デザイン、過去の履歴は引き継がない。指定した名前・説明・出力形式と現在の作成者を設定し、空の出力書類を1件作成する。履歴は親のない「新規書類を作成」から始まる。作成前の全体を自動バックアップし、作成操作自体は通常のUndo/Redoの対象にする。既存書式の出力書類を増やす「書類追加」とは別の操作。


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

ランタイムは以下をvendorに同梱する。portable版も別ファイルのvendorを参照し、CDNへアクセスしない。 HTMLとvendorは同じ配布版を組み合わせる。Word編集は`DocBenchEditorLib.TextSelection`、`Selection`、`StepMap`の存在と必要なメソッドを開始時に確認し、不足時は`vendor/tiptap.min.js`の差替え・再読込を編集領域に案内する。

| ライブラリ | 版 | 出典 | ライセンス |
| --- | --- | --- | --- |
| JSZip | 3.10.1 | https://github.com/Stuk/jszip | MIT（同梱LICENSEにMIT/GPLの選択条項） |
| pako | 1.0.11 | https://github.com/nodeca/pako | MIT |
| docx | 9.6.1 | https://github.com/dolanmiu/docx | MIT |
| PptxGenJS | 4.0.1 | https://github.com/gitbrent/PptxGenJS | MIT |
| Tiptap core / StarterKit / Table / TextStyleKit / Subscript / Superscript | 3.32.0 | https://github.com/ueberdosis/tiptap | MIT（使用するProseMirror依存も同梱） |
| Jspreadsheet CE | 5.0.4 | https://github.com/jspreadsheet/ce | MIT |
| jSuites | 5.12.0 | https://github.com/jsuites/jsuites | MIT |
| ExcelJS | 4.4.0 | https://github.com/exceljs/exceljs | MIT |
| Konva | 10.0.12 | https://github.com/konvajs/konva | MIT |
| Rete / Area / Connection / Engine / Render utils / Lit plugin | 2.0.6 / 2.3.2 / 2.0.5 / 2.1.1 / 2.0.3 / 2.0.8 | https://retejs.org/ | MIT |
| Lit（Lit HTML・ReactiveElementを含む） | 3.3.3（依存版はlock参照） | https://lit.dev/ | BSD-3-Clause |
| rJSmin（ビルドのみ） | 1.3.0 | https://github.com/ndparker/rjsmin | Apache-2.0 |

ライセンス本文はvendorに保存し、portableにも内包する。ライブラリは固定版を同梱する。TiptapはMITのコア拡張だけを使用し、商用ページレイアウト機能やAI機能は使用しない。再生成用の依存ロックはscripts/editor-buildにある。Reteのnpm配布にライセンス本文がないパッケージは、固定版の上流ソース等からscripts/editor-build/licensesへ保持し、Rete-LICENSE.txtへまとめる。Lit pluginはMIT宣言と同作者のフレームワーク通知の出典を併記する。

## Portableの格納形式

`portable/docbench.html`にアプリ本体・CSS・仕様書・ライセンスを持ち、第三者JS/CSSは`../vendor/`から読み込む。条件ノード編集には追加の`vendor/rete.min.js`も必要。配置は`配置先/portable/docbench.html`と`配置先/vendor/`。必要な実行ファイル一覧はportable/build-manifest.jsonのruntimeFilesを参照する。HTMLだけ移動すると起動できず、ライブラリ配置の確認エラーを表示する。

アプリJavaScriptをライセンス本文とともにJSONへ格納し、gzip + Base64のASCIIデータとしてHTMLへ内包する。展開後はscript要素のtextContentへ設定するため、プログラム中のHTML文字列をHTMLパーサーへ直接渡さない。HTML本体とローダーはASCIIのみ。日本語はHTML数値文字参照またはJavaScriptのUnicodeエスケープで保持する。LF/CRLF変換を許容し、圧縮データが欠けた場合は起動エラーを表示する。展開は別ファイルのローカルpakoを使い、CDN・fetch・eval・CompressionStreamを必要としない。

## Word本文中の制御範囲

Wordの`rich`ブロックは、通常の文章・見出し・リスト・表の中に`fieldRef`を配置する本文です。追加のブロック要素として`repeatBlock`、`conditionBlock`、`pageBreak`を使用できます。`repeatBlock`と`conditionBlock`の`content`は段落・表などのブロック要素の配列です。インライン要素の直下には置きません。

```json
{
  "type": "doc",
  "content": [
    {"type":"paragraph","content":[{"type":"text","text":"支出内訳は以下のとおりです。"}]},
    {"type":"repeatBlock","attrs":{"field":"expenses"},"content":[
      {"type":"paragraph","content":[
        {"type":"fieldRef","attrs":{"field":"expenses.category","part":"value"}},
        {"type":"text","text":"："},
        {"type":"fieldRef","attrs":{"field":"expenses.amount","part":"value"}},
        {"type":"text","text":"円"}
      ]}
    ]},
    {"type":"conditionBlock","attrs":{"when":{"field":"status","equals":"完了"}},"content":[
      {"type":"paragraph","content":[{"type":"text","text":"事業は完了しました。"}]}
    ]},
    {"type":"pageBreak"}
  ]
}
```

- `repeatBlock.attrs.field`はArrayまたはTableのスキーマパス。子項目の`fieldRef.attrs.field`も`expenses.category`のようにスキーマパスで指定し、出力時に最も内側の該当ループの行へ解決します。添字や別名は記述しません。配列の子項目は対応する親の繰り返し範囲内で参照します。
- 単純型Arrayの現在の要素は`fieldRef.attrs.field = "配列パス.value"`。入れ子の繰り返しはすべての親配列の範囲内へ配置します。同じ配列を自身の内側で再度繰り返す指定は禁止です。
- `conditionBlock.attrs.when`は既存の条件形式（`{field, equals}`または`{nodeId}`）。値の型は参照項目と一致させます。書類全体の入力値による判定です。グラフ条件の参照・未接続検証・削除時の解除も通常の出力条件と共通です。
- 制御範囲の判定は非表示項目の投影と共通です。非表示の配列・表および0件の配列・表は出力を省き、保存値は保持します。数値の0やBooleanのfalseを空値と扱いません。
- 通常の文章要素と同様、`attrs.id`で範囲を識別し、編集時にIDを補完します。複製時はIDを振り直します。保存するJSONは未展開の本文です。出力時だけ行パスを解決するため、出力定義へ行データを埋め込みません。
- 本文の検証は5,000要素・16階層以内、出力展開は50,000要素以内です。`valuePath`等の内部計算値をJSONへ指定して参照先を変更することはできません。
