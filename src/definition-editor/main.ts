import { DefinitionEditorApp } from './app';

const root = document.getElementById('app');
if (!root) {
  throw new Error('App root not found.');
}
new DefinitionEditorApp(root).mount();
