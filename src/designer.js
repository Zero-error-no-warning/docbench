/* Interaction layer for the generated preview. It edits Render Definition only. */
(function (root) {
  'use strict';
  const D = root.DocBench;
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const round = n => Math.round(n * 100) / 100;

  function adjustDesignBox(box, dx, dy, page, resize = false, snap = true) {
    const step = snap ? 0.1 : 0.01;
    const grid = n => round(Math.round(n / step) * step);
    const fit = (n, min, max) => round(clamp(grid(n), Math.min(min,max), Math.floor(max*100)/100));
    const next = { ...box };
    if (resize) {
      next.w = fit(box.w + dx, 0.4, page.width - box.x);
      next.h = fit(box.h + dy, 0.4, page.height - box.y);
    } else {
      next.x = fit(box.x + dx, 0, Math.max(0, page.width - box.w));
      next.y = fit(box.y + dy, 0, Math.max(0, page.height - box.h));
    }
    return next;
  }

  function rangeLayout(block, range) {
    const row = Math.min(range.row, range.endRow);
    const col = Math.min(range.col, range.endCol);
    const rows = Math.abs(range.endRow - range.row) + 1;
    const cols = Math.abs(range.endCol - range.col) + 1;
    const label = block.type === 'field' && block.showLabel !== false ? 1 : 0;
    return { ...(block.layout || {}), cell: D.colName(col) + row,
      span: Math.max(1, cols - label), rowSpan: rows };
  }

  function reorderDesignBlocks(blocks, id, target, after = false) {
    if (id === target) return blocks;
    const source = blocks.find(b => b.id === id);
    if (!source || !blocks.some(b => b.id === target)) return blocks;
    const next = blocks.filter(b => b.id !== id);
    const index = next.findIndex(b => b.id === target) + (after ? 1 : 0);
    next.splice(index, 0, source);
    return next;
  }

  function attachDesignCanvas(frame, config) {
    const doc = frame.contentDocument;
    if (!doc || !doc.body || config.design.useTemplate) return null;
    const format = config.format;
    const blocks = config.design.blocks || [];
    const page = D.settings({ ...config.design, outputFormat: format });
    const byId = new Map(blocks.map(b => [b.id, b]));
    let selected = config.selectedId || null, editing = false, gesture = null;
    const resolvedBoxes = new Map();
    const nodes = [...doc.querySelectorAll('[data-block-id]')].filter(n => byId.has(n.dataset.blockId));
    const style = doc.createElement('style');
    style.textContent = '.db-object{cursor:pointer;position:relative;min-height:16px;outline-offset:1px}' +
      '.slide-object.db-object{position:absolute;touch-action:none;user-select:none;cursor:move}' +
      '.db-object.db-selected{outline:3px solid #087f8c!important;outline-offset:1px}' +
      '.db-resize{display:none;position:absolute;right:0;bottom:0;width:22px;height:22px;background:#fff;border:3px solid #087f8c;box-sizing:border-box;cursor:nwse-resize;z-index:100;touch-action:none}' +
      '.db-selected>.db-resize{display:block}' +
      '.db-editing{cursor:text!important;user-select:text!important;outline:2px solid #196c74!important;white-space:pre-wrap;min-height:1em}' +
      '.db-drop-before{border-top:4px solid #087f8c!important}.db-drop-after{border-bottom:4px solid #087f8c!important}' +
      '.sheet td{cursor:cell;user-select:none;touch-action:none}.sheet td.db-range{box-shadow:inset 0 0 0 2px #087f8c;background-color:#dff3f3!important}' +
      '.sheet td.db-selected{outline-offset:-2px}.db-pagebreak{min-height:20px;border-top:1px dashed #93abb3;color:#637780;font-size:9pt}';
    doc.head.append(style);
    const zoom = (config.zoom || 100) / 100;
    if (format === 'pptx') {
      const fit = Math.min(1, Math.max(0.15, (frame.clientWidth - 48) / (page.width * 96 / 2.54)));
      doc.querySelectorAll('.slide').forEach(slide => slide.style.zoom = fit * zoom);
    } else if (format === 'docx') {
      const main = doc.querySelector('main');
      if (main) main.style.zoom = Math.min(1, (frame.clientWidth - 28) / main.getBoundingClientRect().width) * zoom;
    } else if (format === 'xlsx') {
      const sheet = doc.querySelector('.sheet');
      if (sheet) sheet.style.zoom = zoom;
    } else {
      doc.body.style.zoom = zoom;
    }

    function select(id, tell = true) {
      selected = byId.has(id) ? id : null;
      for (const n of nodes) n.classList.toggle('db-selected', n.dataset.blockId === selected);
      if (tell) config.onSelect(selected);
    }
    function clearDrop() {
      nodes.forEach(n => n.classList.remove('db-drop-before', 'db-drop-after'));
    }
    function isEditing(target) {
      return editing || target.isContentEditable || ['INPUT','TEXTAREA','SELECT'].includes(target.tagName);
    }
    function scrollNearEdge(event) {
      if (event.clientY > frame.clientHeight - 32) doc.scrollingElement.scrollTop += 16;
      else if (event.clientY < 24) doc.scrollingElement.scrollTop -= 16;
      if (format === 'xlsx' && event.clientX > frame.clientWidth - 32) doc.scrollingElement.scrollLeft += 20;
    }

    function editText(node, block) {
      if (!['heading', 'text'].includes(block.type) || editing) return;
      const target = node.querySelector(block.type === 'heading' ? 'h1' : 'p') || node;
      const previous = block.text || '';
      editing = true;
      node.draggable = false;
      target.contentEditable = 'true';
      target.classList.add('db-editing');
      target.focus();
      let done = false;
      function finish(cancel) {
        if (done) return;
        done = true;
        const value = target.innerText.replace(/\r/g, '');
        target.contentEditable = 'false';
        target.classList.remove('db-editing');
        editing = false;
        node.draggable = format !== 'pptx';
        if (cancel) target.textContent = previous;
        else if (value !== previous) config.onChange({ kind: 'text', id: block.id, value });
      }
      target.addEventListener('blur', () => finish(false), { once: true });
      target.addEventListener('keydown', event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish(true); }
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); finish(false); }
      });
    }

    if (format === 'pptx') {
      const seen = new Set();
      for (const node of nodes) {
        const block = byId.get(node.dataset.blockId);
        if (seen.has(block.id)) continue; // Split tables and appendices are generated output, not new objects.
        seen.add(block.id);
        node.classList.add('db-object');
        node.tabIndex=0;
        const handle = doc.createElement('span');
        handle.className = 'db-resize';
        handle.setAttribute('aria-label', 'サイズ変更');
        node.append(handle);
        node.addEventListener('dblclick', () => editText(node, block));
        node.addEventListener('pointerdown', event => {
          if (event.button !== 0 || isEditing(event.target)) return;
          event.preventDefault();
          select(block.id);
          node.focus({preventScroll:true});
          const slide = node.closest('.slide');
          const bounds = slide.getBoundingClientRect();
          const nr=node.getBoundingClientRect();
          const scale = bounds.width / page.width;
          const box = {slide:Number(slide.dataset.slide),x:(nr.left-bounds.left)/scale,y:(nr.top-bounds.top)/scale,w:nr.width/scale,h:nr.height/scale,...block.layout};
          const resize = event.target === handle;
          resolvedBoxes.set(block.id,box);
          gesture = { node, slide, box, next: box, resize, x: event.clientX, y: event.clientY,
            startTop: bounds.top, scale, moved: false };
          node.setPointerCapture(event.pointerId);
        });
        node.addEventListener('pointermove', event => {
          if (!gesture || gesture.node !== node) return;
          scrollNearEdge(event);
          const g = gesture;
          const scroll = g.startTop - g.slide.getBoundingClientRect().top;
          const dx = (event.clientX - g.x) / g.scale;
          const dy = (event.clientY - g.y + scroll) / g.scale;
          if (Math.abs(dx) + Math.abs(dy) > 0.05) g.moved = true;
          g.next = adjustDesignBox(g.box, dx, dy, page, g.resize, config.snap !== false && !event.altKey);
          for (const k of ['x','y','w','h']) node.style[{x:'left',y:'top',w:'width',h:'height'}[k]] = g.next[k] + 'cm';
        });
        node.addEventListener('pointerup', event => {
          if (!gesture || gesture.node !== node) return;
          const g = gesture;
          gesture = null;
          if (node.hasPointerCapture(event.pointerId)) node.releasePointerCapture(event.pointerId);
          if (!g.moved) return;
          if (!g.resize) {
            const target = doc.elementFromPoint(event.clientX, event.clientY)?.closest('.slide');
            if (target && target !== g.slide) {
              const rect = target.getBoundingClientRect();
              g.next = adjustDesignBox({ ...g.next, x:0, y:0 },
                (event.clientX - rect.left) / g.scale - g.box.w / 2,
                (event.clientY - rect.top) / g.scale - g.box.h / 2, page);
              g.next.slide = Number(target.dataset.slide);
            }
          }
          config.onChange({ kind: 'layout', id: block.id, layout: g.next });
        });
        node.addEventListener('pointercancel', () => {
          if (!gesture || gesture.node !== node) return;
          for (const k of ['x','y','w','h']) node.style[{x:'left',y:'top',w:'width',h:'height'}[k]] = gesture.box[k] + 'cm';
          gesture = null;
        });
      }
    } else if (format === 'xlsx') {
      const cells = [...doc.querySelectorAll('[data-cell]')];
      let start = null;
      const cellRange = cell => ({row:Number(cell.dataset.row),col:Number(cell.dataset.col),
        endRow:Number(cell.dataset.row) + cell.rowSpan - 1,endCol:Number(cell.dataset.col) + cell.colSpan - 1});
      function rangeAt(end) {
        const a = cellRange(start), b = cellRange(end);
        return {row:Math.min(a.row,b.row),col:Math.min(a.col,b.col),
          endRow:Math.max(a.endRow,b.endRow),endCol:Math.max(a.endCol,b.endCol)};
      }
      function showRange(range) {
        for (const cell of cells) {
          const r = cellRange(cell);
          cell.classList.toggle('db-range', r.row<=range.endRow && r.endRow>=range.row && r.col<=range.endCol && r.endCol>=range.col);
        }
        config.onRange(range);
      }
      for (const cell of cells) {
        cell.tabIndex=0;
        cell.addEventListener('pointerdown', event => {
          if (event.button !== 0 || isEditing(event.target)) return;
          event.preventDefault();
          if (cell.dataset.blockId) select(cell.dataset.blockId);
          cell.focus({preventScroll:true});
          start = cell;
          showRange(cellRange(cell));
          cell.setPointerCapture(event.pointerId);
        });
        cell.addEventListener('pointermove', event => {
          if (!start) return;
          scrollNearEdge(event);
          const end = doc.elementFromPoint(event.clientX,event.clientY)?.closest('[data-cell]');
          if (end) showRange(rangeAt(end));
        });
        cell.addEventListener('pointerup', event => {
          start = null;
          if (cell.hasPointerCapture(event.pointerId)) cell.releasePointerCapture(event.pointerId);
        });
        cell.addEventListener('pointercancel', () => { start = null; });
        cell.addEventListener('dragover', event => event.preventDefault());
        cell.addEventListener('drop', event => {
          event.preventDefault();
          const id = event.dataTransfer.getData('text/plain');
          if (byId.has(id)) config.onChange({kind:'range',id,range:cellRange(cell)});
        });
        cell.addEventListener('dblclick', () => {
          const block = byId.get(cell.dataset.blockId);
          if (block && ['heading','text'].includes(block.type)) editText(cell, block);
        });
      }
      if(config.range)showRange(config.range);
    } else {
      for (const node of nodes) {
        const block = byId.get(node.dataset.blockId);
        node.classList.add('db-object');
        node.tabIndex=0;
        node.draggable = true;
        if (block.type === 'pagebreak') {
          node.classList.add('db-pagebreak');
          node.textContent = '改ページ';
        }
        node.addEventListener('click', () => {select(block.id);node.focus({preventScroll:true});});
        node.addEventListener('dblclick', () => editText(node, block));
        node.addEventListener('dragstart', event => {
          select(block.id);
          event.dataTransfer.setData('text/plain',block.id);
          event.dataTransfer.effectAllowed = 'move';
        });
        node.addEventListener('dragover', event => {
          event.preventDefault(); clearDrop();
          node.classList.add(event.clientY > node.getBoundingClientRect().top + node.getBoundingClientRect().height / 2 ? 'db-drop-after' : 'db-drop-before');
        });
        node.addEventListener('drop', event => {
          event.preventDefault();
          const id = event.dataTransfer.getData('text/plain');
          const after = node.classList.contains('db-drop-after');
          clearDrop();
          if (byId.has(id)) config.onChange({kind:'reorder',id,target:block.id,after});
        });
        node.addEventListener('dragend', clearDrop);
      }
    }

    doc.addEventListener('keydown', event => {
      if (isEditing(event.target)) return;
      const key = event.key.toLowerCase(), command = event.ctrlKey || event.metaKey;
      if (command && key === 'z') { event.preventDefault(); config.onCommand(event.shiftKey?'redo':'undo'); }
      else if (command && key === 'd') { event.preventDefault(); config.onCommand('duplicate'); }
      else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); config.onCommand('delete'); }
      else if (event.key === 'Escape') select(null);
      else if (format === 'pptx' && selected && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) {
        event.preventDefault();
        const block = byId.get(selected), step = event.shiftKey ? 1 : 0.1;
        config.onChange({kind:'layout',id:selected,layout:adjustDesignBox(resolvedBoxes.get(selected)||block.layout,
          event.key==='ArrowRight'?step:event.key==='ArrowLeft'?-step:0,
          event.key==='ArrowDown'?step:event.key==='ArrowUp'?-step:0,page)});
      }
    });
    select(selected, false);
    return { select };
  }
  Object.assign(D, { adjustDesignBox, rangeLayout, reorderDesignBlocks, attachDesignCanvas });
})(globalThis);
