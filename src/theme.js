// 라이트/다크 모드. 선택은 이 브라우저(localStorage)에만 저장하고, 없으면 시스템 설정을 따른다.
const KEY = 'theme';

export function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function apply(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem(KEY, theme); } catch { /* 저장이 막혀도 이번 화면은 바뀐다 */ }
}

export function initThemeButton(button) {
  const label = () => { button.textContent = currentTheme() === 'dark' ? '☀️ 라이트 모드' : '🌙 다크 모드'; };
  button.addEventListener('click', () => { apply(currentTheme() === 'dark' ? 'light' : 'dark'); label(); });
  label();
}
