const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs, text) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text !== undefined) el.textContent = text;
  return el;
};

// 가로 막대 그래프. items: [{label, value}]
export function barChart(items, { width = 640, barHeight = 22, format = (v) => v.toLocaleString('ko-KR') } = {}) {
  const gap = 8, labelW = 110, valueW = 110;
  const max = Math.max(1, ...items.map((i) => i.value));
  const svg = s('svg', { viewBox: `0 0 ${width} ${items.length * (barHeight + gap)}`, width: '100%', role: 'img' });
  items.forEach((it, i) => {
    const y = i * (barHeight + gap);
    const w = Math.max(1, ((width - labelW - valueW) * it.value) / max);
    svg.append(
      s('text', { x: 0, y: y + barHeight * 0.7, class: 'chart-label' }, it.label),
      s('rect', { x: labelW, y, width: w, height: barHeight, rx: 4, class: 'chart-bar' }),
      s('text', { x: labelW + w + 6, y: y + barHeight * 0.7, class: 'chart-value' }, format(it.value)),
    );
  });
  return svg;
}
