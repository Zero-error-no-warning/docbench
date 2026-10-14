import { RenderDesignerApp } from './app';

const root = document.getElementById('app');
if (!root) {
  throw new Error('App root not found.');
}
new RenderDesignerApp(root).mount();
