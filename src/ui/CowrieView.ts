// Cowrie shells that tumble when thrown and land open (mouth up) or closed.

import type { CowrieThrow } from '../core/cowrie';
import { sfx } from './sound';

const NS = 'http://www.w3.org/2000/svg';

function shellSvg(): SVGSVGElement {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '-30 -20 60 40');
  s.setAttribute('class', 'shell');
  s.innerHTML = `
    <ellipse class="shell-body" rx="27" ry="17"/>
    <g class="mouth">
      <path d="M-18,0 C-8,-3 8,-3 18,0 C8,3 -8,3 -18,0 Z" class="slit"/>
      <path d="M-12,-2 v-4 M-6,-3 v-4 M0,-3 v-4 M6,-3 v-4 M12,-2 v-4 M-12,2 v4 M-6,3 v4 M0,3 v4 M6,3 v4 M12,2 v4" class="teeth"/>
    </g>
    <g class="back">
      <ellipse rx="19" ry="10" class="hump"/>
      <ellipse cx="-6" cy="-4" rx="7" ry="3" class="hump-shine"/>
    </g>`;
  return s;
}

export class CowrieView {
  readonly el: HTMLDivElement;
  private shells: SVGSVGElement[];

  constructor(count = 4) {
    this.el = document.createElement('div');
    this.el.className = count > 5 ? 'cowries many' : 'cowries';
    this.el.setAttribute('aria-hidden', 'true');
    this.shells = Array.from({ length: count }, () => shellSvg());
    this.el.append(...this.shells);
    this.show(this.shells.map((_, i) => i % 2 === 0));
  }

  private show(faces: readonly boolean[]): void {
    this.shells.forEach((s, i) => {
      s.classList.toggle('up', faces[i]!);
      s.style.setProperty('--rot', `${Math.round(Math.random() * 50 - 25)}deg`);
    });
  }

  async roll(result: CowrieThrow): Promise<void> {
    sfx.shells();
    this.el.classList.add('rolling');
    const flips = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 6;
    for (let i = 0; i < flips; i++) {
      this.show(this.shells.map(() => Math.random() < 0.5));
      await new Promise((r) => setTimeout(r, 80));
    }
    this.el.classList.remove('rolling');
    this.show(result.shells);
  }
}
