import type { Ruleset } from '@doorway/engine';

/** The quick reference (rulebook §18), with numbers from the ruleset in play. */
export function RulesReference({ r, players }: { r: Ruleset; players: number }) {
  const tiles =
    players === 1 ? `${r.solo.doorway} (solo)` : (r.doorway[String(players)] ?? r.doorway['4']).join(' / ');
  const pk = Object.keys(r.passion).sort((a, b) => Number(a) - Number(b));
  return (
    <div className="grid gap-x-6 gap-y-2 text-sm md:grid-cols-2" data-testid="rules-ref">
      <div>
        <b>Who goes</b> — furthest back. Ties: the top pawn. No rounds.
      </div>
      <div>
        <b>Quest</b> — take a card your age or younger, pay its years (minus discounts, minimum {r.minCost}),
        move, put its disc on top.
      </div>
      <div>
        <b>Rush</b> — jump to just past the nearest pawn ahead (or{' '}
        {players === 1 ? r.solo.rush : r.rushNoPawnAhead} spaces).
        {r.rushDiscard ? ' You may discard one market card first.' : ''}
      </div>
      <div>
        <b>Ages</b> — Young {r.ageBands.young.join('–')} · Middle {r.ageBands.middle.join('–')} · Old{' '}
        {r.ageBands.old.join('–')}. Checked at the start of your turn.
      </div>
      <div>
        <b>Experience</b> — every {r.experienceStep} discs of a domain make that domain 1 year cheaper (up to
        −{r.experienceCap}).
      </div>
      <div>
        <b>Milestones {r.milestones.join(' · ')}</b> — the first time you reach each, you may swap two
        adjacent discs.
      </div>
      <div>
        <b>Doorway</b> — keep one unbroken stretch: {tiles} discs by arrival order.
      </div>
      <div>
        <b>Score</b> — card points + {r.fullLifeBonus} per full set of five + longest run (
        {pk.map((k) => `${k}${k === pk[pk.length - 1] ? '+' : ''}: ${r.passion[k]}`).join(' · ')}) +
        Reflection ({r.reflectionPerDisc} per disc).
      </div>
      <div>
        <b>Powers</b> — stay active even if the card falls away at the Doorway. Once-per-game powers are never
        forced.
      </div>
      <div>
        <b>Ties</b> — most discs kept, then earlier arrival, then shared.
      </div>
    </div>
  );
}
