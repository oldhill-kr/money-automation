import { h } from './dom.js';

const css = (c) => `--c:${c}`;

// 가로 막대 목록. items: [{label, value, color?, segments?: [{value, color, label}], selected?}]
// segments가 있으면 한 줄을 색 구간으로 쌓아서 보여 준다(월별 카테고리 구성).
export function barChart(items, { format = (v) => v.toLocaleString('ko-KR'), color = 'var(--accent)' } = {}) {
  const max = Math.max(1, ...items.map((i) => Math.max(0, i.value)));
  return h('div', { class: 'hbars', role: 'img' },
    items.map((it) => {
      const parts = it.segments?.length ? it.segments : [{ value: it.value, color: it.color || color, label: it.label }];
      return h('div', { class: `hrow${it.selected ? ' sel' : ''}` },
        h('span', { class: 'hl', title: it.label }, it.label),
        h('div', { class: 'ht' }, parts.filter((p) => p.value > 0).map((p) =>
          h('i', { style: `width:${(p.value / max) * 100}%;${css(p.color)}`, title: `${p.label ?? it.label} ${format(p.value)}` }))),
        h('span', { class: 'hv' }, format(it.value)));
    }));
}

// 한 줄 구성 막대 + 항목별 범례(색 점, 막대, 금액, 비율). parts: [{label, value, color}]
export function compositionChart(parts, { format }) {
  const list = parts.filter((p) => p.value > 0).sort((a, b) => b.value - a.value);
  const total = list.reduce((s, p) => s + p.value, 0) || 1;
  const top = list[0]?.value || 1;
  return h('div', {},
    h('div', { class: 'stack', role: 'img' }, list.map((p) =>
      h('i', { style: `width:${(p.value / total) * 100}%;${css(p.color)}`, title: `${p.label} ${format(p.value)}` }))),
    h('div', { class: 'legend' }, list.map((p) =>
      h('div', { class: 'lg', style: css(p.color) },
        h('span', { class: 'dot' }), h('span', {}, p.label),
        h('span', { class: 'bar' }, h('i', { style: `width:${(p.value / top) * 100}%` })),
        h('span', { class: 'amt' }, format(p.value)),
        h('span', { class: 'pct' }, `${((p.value / total) * 100).toFixed(1)}%`)))));
}
