import { DEFAULT_RULESET } from '@doorway/content';
import { RulesReference } from '@/components/rules-ref';
import { SiteNav } from '@/components/site-nav';

export const metadata = { title: 'How to play' };

const r = DEFAULT_RULESET;
const [yMin, yMax] = r.ageBands.young;
const [mMin, mMax] = r.ageBands.middle;
const [oMin, oMax] = r.ageBands.old;

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4 rounded-2xl border border-line bg-surface-2 px-[18px] py-4">
      <span
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-door font-display text-base font-extrabold text-ink"
      >
        {n}
      </span>
      <div>
        <h3 className="m-0 font-display text-lg">{title}</h3>
        <div className="mt-1 space-y-2 text-[15px] leading-relaxed">{children}</div>
      </div>
    </li>
  );
}

export default function Rules() {
  return (
    <div className="mx-auto max-w-[760px] pb-10">
      <SiteNav />
      <main className="px-4 pt-6 md:px-7">
        <h1 className="m-0 font-display text-[40px] font-extrabold">How to play</h1>
        <p className="text-lg text-muted">
          You live one whole life. Every life ends at the same small <b>Doorway</b>, and the Doorway only lets
          you carry <b>one stretch</b> of your life through. Make that stretch great.
        </p>

        <h2 className="mt-8 font-display text-xl">The idea in 20 seconds</h2>
        <ul className="list-disc space-y-1 pl-5 text-[15px] leading-relaxed">
          <li>
            Everyone walks along a path from <b>0 to 40</b>. That is a life, one space per year.
          </li>
          <li>
            On your turn you either <b>do something</b> (spend years, get a memory) or <b>skip ahead</b>.
          </li>
          <li>
            Memories are coloured discs that stack into a <b>tower</b>, in the order you lived them.
          </li>
          <li>
            At the end you keep only <b>one unbroken slice</b> of your tower. Only that slice scores.
          </li>
          <li>Most points wins.</li>
        </ul>

        <h2 className="mt-8 font-display text-xl">Your first turn, step by step</h2>
        <ol className="m-0 mt-3 list-none space-y-3 p-0">
          <Step n={1} title="Wait for your turn: whoever is furthest back goes">
            <p>
              There are no rounds. The pawn <b>furthest back on the path</b> always moves next. If you are
              still last after moving, you go again. (Tied? The pawn on top of the pile goes.)
            </p>
          </Step>
          <Step n={2} title="Pick one: Quest or Rush">
            <p>
              <b>Quest</b> — take a card from the market. It costs some <b>years</b>: you walk forward that
              many spaces. In return you get its coloured <b>disc</b> on top of your tower, and the card’s
              points (if you keep it at the end).
            </p>
            <p>
              <b>Rush</b> — skip ahead to just past the next player in front of you (or {r.rushNoPawnAhead}{' '}
              spaces if nobody is ahead). No card, no disc. Handy when nothing is worth buying, or to hand the
              next turn to someone you jumped over.
            </p>
          </Step>
          <Step n={3} title="Which cards can I take?">
            <p>
              Cards come in three ages. You can take cards from <b>your age or younger</b>:
            </p>
            <p>
              Young ({yMin}–{yMax}) · Middle ({mMin}–{mMax}) · Old ({oMin}–{oMax}).
            </p>
            <p>
              Some cards also say “needs 2 Love”, meaning you must already own that many discs of that colour.
              Cards you can’t take just stay in the market.
            </p>
          </Step>
          <Step n={4} title="Doing the same thing gets cheaper">
            <p>
              Every {r.experienceStep} discs of one colour makes that colour <b>1 year cheaper</b>. Lean into
              a colour and you can fit more quests into your life. Nothing ever costs less than {r.minCost}{' '}
              year.
            </p>
          </Step>
          <Step n={5} title="Special moments on the way">
            <p>
              <b>Landing on or passing {r.milestones.join(', ')}</b> lets you swap two neighbouring discs in
              your tower, which is a nice way to line up colours.
            </p>
            <p>
              Some cards have a <b>power</b> (a discount, an extra step…). It works from the moment you take
              it, even if the card doesn’t make it through the Doorway.
            </p>
          </Step>
          <Step n={6} title="Reach the Doorway at 40">
            <p>
              When you hit space 40 you stop taking turns. The <b>first</b> to arrive may keep the most discs
              (9 in a 4-player game), the next fewer, and so on. Arrive early and keep a lot, or arrive late
              and have had more turns to build something great. That is the whole tension.
            </p>
            <p>
              Choose <b>one unbroken run</b> of discs up to your limit. Everything outside it is gone,
              including the cards.
            </p>
          </Step>
          <Step n={7} title="Count points: only your kept slice counts">
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <b>Card points</b> — the number on each kept card.
              </li>
              <li>
                <b>Full life</b> — +{r.fullLifeBonus} for each set of all five colours.
              </li>
              <li>
                <b>Passion</b> — your longest row of one colour touching: 3 in a row = 3, 4 = 6, 5+ = 10.
              </li>
              <li>
                <b>Reflection</b> — a few Old cards give +{r.reflectionPerDisc} per kept disc of their colour.
              </li>
            </ul>
            <p>Highest total wins. Tie? Most discs kept, then whoever arrived first.</p>
          </Step>
        </ol>

        <h2 className="mt-8 font-display text-xl">Tips for your first game</h2>
        <ul className="list-disc space-y-1 pl-5 text-[15px] leading-relaxed">
          <li>
            <b>Don’t overthink it.</b> Take a cheap Young card, see what happens. The game is short.
          </li>
          <li>
            <b>Plan your slice.</b> The discs that made you cheap sit at the bottom of your tower — they might
            not be the ones you keep.
          </li>
          <li>
            <b>Turn on hints</b> in the game: the table highlights your best window and previews your score.
          </li>
        </ul>

        <h2 className="mt-8 font-display text-xl">Solo challenge</h2>
        <p className="text-[15px] leading-relaxed">
          Play alone against the clock of the world. Your Doorway limit is {r.solo.doorway}, Rush moves{' '}
          {r.solo.rush}, and after each of your turns the oldest card in each market row disappears. Ratings:
          under 25 <i>A quiet life</i> · 25–34 <i>A good life</i> · 35–44 <i>A full life</i> · 45+{' '}
          <i>Everything you could bring</i>.
        </p>

        <details className="mt-8 rounded-2xl border border-line bg-surface-2 px-[18px] py-4">
          <summary className="cursor-pointer font-display text-lg">Quick reference (cheat sheet)</summary>
          <div className="mt-3">
            <RulesReference r={r} players={4} />
          </div>
        </details>
      </main>
    </div>
  );
}
