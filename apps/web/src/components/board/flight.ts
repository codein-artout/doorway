// Stretch item: the taken card flies to the top of "Your life" and lands as a chip (Board only).
// Pure presentation: it runs after the move is submitted and never delays or changes it.

import { prefersReducedMotion } from '@/lib/use-game';
import { DOMAIN } from '@/lib/domains';
import type { Domain } from '@doorway/engine';
import type { TableController } from '@/lib/use-table';

export function flyCardToTower(cardId: string, domain: Domain) {
  if (typeof document === 'undefined' || prefersReducedMotion()) return;
  const from = document.querySelector<HTMLElement>(`[data-card="${CSS.escape(cardId)}"]`);
  const life = document.querySelector<HTMLElement>('[data-testid="your-life"]');
  const to = life?.querySelector<HTMLElement>('[data-flight-target]') ?? life;
  if (!from || !to || typeof from.animate !== 'function') return;
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const ghost = document.createElement('div');
  ghost.setAttribute('aria-hidden', 'true');
  Object.assign(ghost.style, {
    position: 'fixed',
    left: `${a.left}px`,
    top: `${a.top}px`,
    width: `${a.width}px`,
    height: `${a.height}px`,
    borderRadius: '14px',
    border: '3px solid var(--ink)',
    background: DOMAIN[domain].css,
    zIndex: '60',
    pointerEvents: 'none',
  });
  document.body.appendChild(ghost);
  const dx = b.left + 46 - (a.left + a.width / 2);
  const dy = b.top + 11 - (a.top + a.height / 2);
  const anim = ghost.animate(
    [
      { transform: 'translate(0,0) rotate(0deg)', borderRadius: '14px', opacity: 1 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 60}px) rotate(-8deg) scale(0.6, 0.4)`, opacity: 1 },
      {
        transform: `translate(${dx}px, ${dy}px) scale(${92 / a.width}, ${18 / a.height})`,
        borderRadius: '999px',
        opacity: 0.9,
      },
    ],
    { duration: 520, easing: 'cubic-bezier(.3,.7,.4,1)' },
  );
  const done = () => ghost.remove();
  anim.onfinish = done;
  anim.oncancel = done;
}

/** Confirm the selected move; a quest also sends its card flying to the tower. */
export function confirmWithFlight(t: TableController) {
  const m = t.selectedMove;
  const ok = t.myTurn && !!m;
  if (ok && m.type === 'quest') flyCardToTower(m.cardId, t.state.cards[m.cardId].color);
  t.confirm();
}
