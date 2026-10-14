# DocBench Architecture

DocBench is a local-first, browser-based document platform built as three static TypeScript apps bundled by Vite.

## Apps
- **Definition Editor**: authors `DefinitionFile` JSON documents describing sections, fields, layouts, conditions, validation, arrays, and tables.
- **Render Designer**: authors `RenderDefinition` JSON documents that bind templates to output formats.
- **Form Runtime**: loads definitions, captures `DocumentData`, validates input, stores attachments, and generates rendered previews.

## Shared modules
- `src/shared/types.ts`: canonical file-format and history interfaces.
- `src/shared/diff.ts`: JSON diff and patch helpers.
- `src/shared/schema.ts`: runtime validation engine against field and section definitions.
- `src/shared/storage.ts`: IndexedDB wrapper for definitions, render definitions, documents, attachments, history, and backups.
- `src/shared/history.ts`: undo/redo, snapshots, branching, merge, and periodic backup hooks.

## Persistence model
- IndexedDB database name: `docbench`
- Stores: `definitions`, `renderDefinitions`, `documentData`, `attachments`, `history`, `backups`
- JSON file export/import keeps formats human-readable and AI-friendly.

## UX model
- Multi-pane editors for authoring.
- Keyboard shortcuts: Ctrl/Cmd+S, Ctrl/Cmd+Z, Ctrl/Cmd+Y.
- Prompt-based branch/merge workflows for snapshot history.
- Static assets only, suitable for SharePoint Classic hosting.
