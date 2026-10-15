import { NodeEditor, ClassicPreset } from 'rete';
import { AreaPlugin, AreaExtensions } from 'rete-area-plugin';
import { ConnectionPlugin, Presets as ConnectionPresets } from 'rete-connection-plugin';
import { LitPlugin, Presets as LitPresets } from '@retejs/lit-plugin';
import { DataflowEngine } from 'rete-engine';
import { LitElement, html, css } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
import { getDOMSocketPosition } from 'rete-render-utils';
globalThis.DocBenchRuleLib={NodeEditor,ClassicPreset,AreaPlugin,AreaExtensions,ConnectionPlugin,ConnectionPresets,LitPlugin,LitPresets,DataflowEngine,LitElement,html,css,keyed,getDOMSocketPosition};
