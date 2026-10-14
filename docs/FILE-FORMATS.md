# DocBench File Formats

## Definition File
`DefinitionFile` captures the schema for data collection.

Key properties:
- `version`, `id`, `name`, `description`
- `sections[]` with `fields[]`, `layout`, and optional `condition`
- `metadata` timestamps, author, and tags

## Render Definition
`RenderDefinition` links a definition to one or more output templates.

Key properties:
- `definitionId` reference to a `DefinitionFile`
- `outputs[]` containing output `format` and template payload
- template `content`, optional `styles`, and optional section overrides

## Document Data
`DocumentData` stores captured user input.

Key properties:
- `definitionId`, optional `renderDefinitionId`
- `data` object keyed by field names
- `attachments[]` with IndexedDB storage references
- `metadata` for created/modified tracking

## History
History snapshots are JSON objects containing branch state and snapshots. Diffs are RFC6902-style operations:
- `add`
- `remove`
- `replace`

## Notes
- All exported files are plain JSON.
- Formats are optimized to stay readable for people and automation.
- Attachments store binary content in IndexedDB and references in exported document JSON.
