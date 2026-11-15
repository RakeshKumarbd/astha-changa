// Tiny DOM helpers shared by the screens.

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: object = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids);
  return e;
}

export function button(text: string, className: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', { type: 'button', className, textContent: text });
  b.addEventListener('click', onClick);
  return b;
}

/** A row of toggle buttons where exactly one is pressed. */
export function segmented<T>(label: string, options: [T, string, boolean?][], value: T, onPick: (v: T) => void): HTMLElement {
  const group = el('div', { className: 'segmented', role: 'group' });
  group.setAttribute('aria-label', label);
  for (const [v, text, disabled] of options) {
    const b = el('button', { type: 'button', textContent: text, disabled: !!disabled });
    b.setAttribute('aria-pressed', String(v === value));
    b.addEventListener('click', () => onPick(v));
    group.append(b);
  }
  return group;
}

export function checkbox(label: string, checked: boolean, onChange: (v: boolean) => void): HTMLLabelElement {
  const input = el('input', { type: 'checkbox', checked });
  input.addEventListener('change', () => onChange(input.checked));
  return el('label', { className: 'check' }, input, label);
}

/** A modal card over the page; returns a close function. */
export function showDialog(host: HTMLElement, ...content: Node[]): () => void {
  const card = el('div', { className: 'card dialog-card', role: 'dialog' }, ...content);
  card.setAttribute('aria-modal', 'true');
  const overlay = el('div', { className: 'overlay' }, card);
  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => e.target === overlay && close());
  overlay.addEventListener('keydown', (e) => e.key === 'Escape' && close());
  host.append(overlay);
  card.querySelector<HTMLElement>('button, input, textarea, select')?.focus();
  return close;
}

/** A short message that fades away. */
export function toast(host: HTMLElement, text: string): void {
  const t = el('div', { className: 'toast', role: 'status', textContent: text });
  host.append(t);
  setTimeout(() => t.remove(), 3200);
}
