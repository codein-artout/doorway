'use client';
import { CARDS, DEFAULT_RULESET } from '@doorway/content';
import { scenario, scoreCards, type Domain } from '@doorway/engine';
import { ActionBar } from '@/components/actions';
import { QuestCard, DeckSlot, AgeLabel } from '@/components/market';
import { Disc, MiniDisc, Pawn, Chip, Button } from '@/components/primitives';
import { ScoreTiles, TowerList } from '@/components/score';
import { DoorwayArch, DoorwayTiles, Track, TrackCell } from '@/components/track';
import { QueueCard, TurnBanner } from '@/components/turn';
import { WindowBracketDemo } from '@/components/doorway';
import { cardView, queue } from '@/lib/table-model';
import { DOMAIN_ORDER } from '@/lib/domains';
import { currentPlayer, previewMove } from '@doorway/engine';
import { BoardSheet } from '@/components/board/board-sheet';
import { BoardCard, Chip as BoardChip, ChipLabel, PawnFigure, TrayButton } from '@/components/board/pieces';
import { BoardDoorway } from '@/components/board/board-doorway';
import { AnalystDoorway } from '@/components/analyst/analyst-doorway';
import { LineChart, PlayersLedger, TrackRuler, WhyPanel } from '@/components/analyst/analyst-table';
import { AnalystButton } from '@/components/analyst/panel';
import { lastBotWhy, positionChart, queueText, scoreChart, turnPoints } from '@/lib/analyst-model';
import { demoState, demoTimeline } from '@/lib/demo';

const DEMO = demoState();
const DEMO_TL = demoTimeline();
const DEMO_POINTS = turnPoints(DEMO_TL);
/** A finished-looking tower at the Doorway for the two Doorway screens. */
const AT_DOOR = scenario(
  DEFAULT_RULESET,
  CARDS,
  [
    { id: 'p1', name: 'Priya' },
    { id: 'p2', name: 'Arun', isBot: true, botPolicy: 'tempo' },
  ],
  {
    players: {
      p1: {
        position: 40,
        arrivalOrder: 1,
        doorwayAllowance: 9,
        tower: [
          'PU-Y1',
          'GR-Y2',
          'GD-Y1',
          'GD-Y3',
          'GD-M2',
          'PK-Y5',
          'OR-M3',
          'PU-M2',
          'GR-M3',
          'GD-O3',
          'OR-O2',
          'PK-O1',
        ],
      },
      p2: { position: 33, tower: ['GR-Y1', 'OR-Y1'] },
    },
    stacks: { 40: ['p1'], 33: ['p2'] },
  },
);

const S = scenario(
  DEFAULT_RULESET,
  CARDS,
  [
    { id: 'p1', name: 'Priya' },
    { id: 'p2', name: 'Arun', isBot: true, botPolicy: 'tempo' },
    { id: 'p3', name: 'Meera' },
    { id: 'p4', name: 'Kavi', isBot: true, botPolicy: 'specialist' },
  ],
  {
    market: { young: ['GD-Y4', 'PK-Y3', 'OR-Y5'], middle: ['PU-M2', 'GR-M2'], old: ['PK-O2', 'OR-O3'] },
    players: {
      p1: { position: 11, tower: ['PU-Y2', 'PK-Y5', 'GD-Y1', 'PK-Y4'], milestonesUsed: [10] },
      p2: {
        position: 14,
        tower: ['GR-Y2', 'GR-Y1', 'OR-Y1', 'GR-Y3', 'OR-Y2', 'PK-Y1'],
        milestonesUsed: [10],
      },
      p3: { position: 17, tower: ['PU-Y5', 'PU-Y4', 'GD-Y5', 'PU-M3'], milestonesUsed: [10] },
      p4: { position: 20, tower: ['GD-Y3', 'GD-Y2', 'OR-Y4', 'GD-M2', 'GD-M1'], milestonesUsed: [10, 20] },
    },
    stacks: { 11: ['p1'], 14: ['p2'], 17: ['p3'], 20: ['p4'] },
  },
);

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="m-0 mb-3 font-display text-[19px] font-bold">{title}</h2>
      {children}
    </section>
  );
}

function DesignCheckBody() {
  const v = (id: string, o: Partial<{ myTurn: boolean; rushMode: boolean; discarding: boolean }> = {}) =>
    cardView(S, 'p1', id, { myTurn: true, rushMode: false, discarding: false, ...o });
  const q = queue(S);
  return (
    <main className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-6 md:px-7">
      <h1 className="m-0 font-display text-[38px] font-extrabold">Design check</h1>
      <p className="m-0 text-muted">
        Every core component in every state, rendered from the shared engine. Tokens: DESIGN.md §1.
      </p>
      <Box title="Disc — normal · kept · left behind · new; minis">
        <div className="flex flex-wrap items-center gap-3">
          {DOMAIN_ORDER.map((d) => (
            <Disc key={d} domain={d as Domain} />
          ))}
          <Disc domain="pink" state="kept" />
          <Disc domain="gold" state="left" />
          <Disc domain="green" state="new" />
          <Disc domain="purple" w={220} h={34} />
          {DOMAIN_ORDER.map((d) => (
            <MiniDisc key={d} domain={d as Domain} />
          ))}
        </div>
      </Box>
      <Box title="Pawn — human · bot · current · ghost (R34)">
        <div className="flex items-center gap-4">
          <Pawn initial="P" />
          <Pawn initial="A" isBot />
          <Pawn initial="M" current />
          <Pawn initial="K" isBot current />
          <Pawn initial="P" ghost />
          <Pawn initial="P" size={30} />
        </div>
      </Box>
      <Box title="Track cell — plain · Milestone · stacked (top on top) · ghost">
        <div className="grid w-[260px] grid-cols-5 gap-0.5">
          <TrackCell n={9} age="young" milestone={false} pawns={[]} />
          <TrackCell n={10} age="young" milestone pawns={[{ id: 'a', name: 'Arun', isBot: true }]} />
          <TrackCell
            n={14}
            age="middle"
            milestone={false}
            pawns={[
              { id: 'm', name: 'Meera', isBot: false },
              { id: 'p', name: 'Priya', isBot: false },
            ]}
            current="p"
          />
          <TrackCell n={20} age="middle" milestone pawns={[]} ghost ghostInitial="P" />
          <TrackCell n={30} age="old" milestone pawns={[]} />
        </div>
      </Box>
      <Box title="Life track">
        <Track state={S} current="p1" ghost={{ space: 13, initial: 'P' }} />
      </Box>
      <Box title="Doorway — arch and tiles">
        <div className="flex flex-wrap items-end gap-6">
          <DoorwayArch />
          <DoorwayArch width={120} height={150}>
            <span className="font-display text-[44px] leading-none font-extrabold">32</span>
            <span className="text-xs">points</span>
          </DoorwayArch>
          <DoorwayTiles ruleset={DEFAULT_RULESET} players={4} taken={1} />
        </div>
      </Box>
      <Box title="Quest card — legal · selected · illegal (too young / requirement) · discard target · waiting">
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-6">
          <QuestCard v={v('GD-Y4')} selected={false} discarding={false} clickable />
          <QuestCard v={v('PK-Y3')} selected discarding={false} clickable />
          <QuestCard v={v('PU-M2')} selected={false} discarding={false} clickable={false} />
          <QuestCard v={v('PK-O2')} selected={false} discarding={false} clickable={false} />
          <QuestCard
            v={v('OR-Y5', { rushMode: true, discarding: true })}
            selected={false}
            discarding
            clickable
          />
          <QuestCard
            v={v('GR-M2', { myTurn: false })}
            selected={false}
            discarding={false}
            clickable={false}
          />
        </div>
        <div className="mt-3 grid grid-cols-[92px_200px] gap-2.5">
          <AgeLabel age="middle" state={S} viewerPos={11} />
          <DeckSlot age="middle" count={15} />
        </div>
      </Box>
      <Box title="Turn banner — yours · again · others' (thinking)">
        <div className="flex flex-col gap-3">
          <TurnBanner
            eyebrow="Turn 23 · your move"
            title="Your turn, Priya."
            why="You’re furthest back, on space 11. Arun is next, at 14."
            whyWho="my"
            whyOrder="Priya 11 → Arun 14 → Meera 17 → Kavi 20"
            mine
          />
          <TurnBanner
            eyebrow="Turn 24 · your move"
            title="You go again, Priya."
            why="You’re still furthest back."
            whyWho="my"
            whyOrder="Priya 13 → Arun 14"
            mine
          />
          <TurnBanner
            eyebrow="Turn 24 · bot move"
            title="Arun is thinking…"
            why="Arun is furthest back now, on space 14."
            whyWho="Arun’s"
            whyOrder="Arun 14 → Priya 15"
            mine={false}
            thinking
          />
        </div>
      </Box>
      <Box title="Turn queue — current · bot thinking · friend choosing">
        <div className="grid gap-3 md:grid-cols-4">
          <QueueCard state={S} e={q[0]} thinking={false} />
          <QueueCard state={S} e={{ ...q[1], current: true }} thinking options={8} />
          <QueueCard state={S} e={q[2]} thinking={false} choosing />
          <QueueCard state={S} e={q[3]} thinking={false} />
        </div>
      </Box>
      <Box title="Action bar">
        <ActionBar
          myTurn
          mode="quest"
          rushTarget={15}
          onQuest={() => {}}
          onRush={() => {}}
          toggles={[
            {
              key: 'ignoreReq',
              label: 'Say yes more',
              detail: 'once · ignore a requirement',
              checked: false,
              onChange: () => {},
            },
          ]}
          previewText="Dance badly at a wedding: 3 years. You move 11 → 14."
          previewNext="You land on Arun and go on top — you move again."
          canUndo
          onUndo={() => {}}
          confirmLabel="Take this quest"
          confirmDisabled={false}
          onConfirm={() => {}}
        />
      </Box>
      <Box title="Score tiles · tower list · window bracket">
        <div className="grid gap-4 md:grid-cols-3">
          <ScoreTiles sc={scoreCards(DEFAULT_RULESET, S.cards, S.players[0].tower)} />
          <TowerList state={S} p={S.players[0]} newest="PK-Y4" />
          <WindowBracketDemo state={S} />
        </div>
      </Box>
      <Box title="Buttons and chips">
        <div className="flex flex-wrap gap-3">
          <Button variant="primary">Take this quest</Button>
          <Button>Quest</Button>
          <Button pressed>Rush → 15</Button>
          <Button variant="ghost">Undo</Button>
          <Button variant="pill">Rules</Button>
          <Button variant="alert">Something feels off</Button>
          <Chip>HEADLINE</Chip>
          <Chip bg="var(--alert)">STUDY</Chip>
        </div>
      </Box>
    </main>
  );
}

/** v2 Board pieces (design/v2/screens/Board-*.dc.html). */
function BoardPieces() {
  const ghost = previewMove(DEMO, { type: 'quest', cardId: 'PK-Y3' }, 'p1').landing;
  return (
    <main className="flex flex-col gap-5 px-4 py-6 text-on-felt md:px-7" aria-label="Board pieces">
      <h2 className="m-0 font-display text-2xl font-normal">Board pieces (v2)</h2>
      <BoardSheet
        state={DEMO}
        current={currentPlayer(DEMO)}
        ghost={{ space: ghost, initial: 'P' }}
        bubble={{ text: 'Your turn, Priya. You are furthest back.', thinking: false }}
      />
      <div className="flex flex-wrap items-end gap-4">
        {DEMO.players.map((p) => (
          <PawnFigure
            key={p.id}
            initial={p.name[0]}
            seat={p.seat}
            isBot={p.isBot}
            current={p.id === 'p1'}
            w={34}
            h={48}
          />
        ))}
        <PawnFigure initial="P" seat={1} isBot={false} ghost w={34} h={48} />
        {DOMAIN_ORDER.map((d) => (
          <BoardChip key={d} domain={d} w={96} h={24} label={<ChipLabel domain={d} />} />
        ))}
      </div>
      <div className="flex flex-wrap gap-3 pt-4">
        {['PK-Y3', 'OR-Y5', 'PU-M2', 'OR-O3'].map((id, i) => (
          <BoardCard
            key={id}
            v={cardView(DEMO, 'p1', id, { myTurn: true, rushMode: false, discarding: false })}
            rot={['-1deg', '0.8deg', '-0.6deg', '1.2deg'][i]}
            selected={i === 0}
            discarding={false}
            clickable={i < 2}
            blockText={i >= 2 ? 'Too young' : null}
            rushMode={false}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <TrayButton kind="ink">Take it</TrayButton>
        <TrayButton>Rush to 13</TrayButton>
        <TrayButton kind="ghost">Undo</TrayButton>
      </div>
      <BoardDoorway state={AT_DOOR} playerId="p1" hintAllowed onLock={() => {}} />
    </main>
  );
}

/** v2 Analyst panels (design/v2/screens/Analyst-*.dc.html). */
function AnalystPieces() {
  const pos = positionChart(DEMO, DEMO_POINTS);
  const sc = scoreChart(DEMO, DEMO_POINTS);
  return (
    <main className="flex flex-col gap-4 px-4 py-6 text-ink md:px-7" aria-label="Analyst panels">
      <h2 className="m-0 text-[13px] font-bold tracking-[0.06em] uppercase">Analyst panels (v2)</h2>
      <TrackRuler
        state={DEMO}
        current={currentPlayer(DEMO)}
        ghost={{ space: 13, label: 'P?' }}
        queueNow={queueText(DEMO)}
        queueAfter="Arun 12 → Priya 13 → Meera 13 → Kavi 15"
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <PlayersLedger state={DEMO} viewer="p1" />
        <WhyPanel why={lastBotWhy(DEMO_POINTS)} />
        <div className="flex flex-wrap items-start gap-2 lg:col-span-4">
          <AnalystButton>Undo</AnalystButton>
          <AnalystButton primary>Take PK-Y3</AnalystButton>
        </div>
        <LineChart
          label="Position by turn"
          title="Position by turn"
          note="demo"
          {...pos}
          gridSteps={4}
          testId="dc-pos"
        />
        <LineChart
          label="Score if you walked through now"
          title="Score if you walked through now"
          note="demo"
          {...sc}
          gridSteps={4}
          testId="dc-score"
        />
      </div>
      <AnalystDoorway state={AT_DOOR} playerId="p1" hintAllowed onLock={() => {}} />
    </main>
  );
}

/** Every component in both views (DESIGN-v2 §1): the same tree under each token set. */
export default function DesignCheck() {
  return (
    <>
      {(['board', 'analyst'] as const).map((v) => (
        <div
          key={v}
          data-view={v}
          className="bg-ground"
          style={{ backgroundImage: 'var(--ground-texture)', backgroundSize: 'var(--ground-texture-size)' }}
          data-testid={`design-check-${v}`}
        >
          <p className="m-0 px-4 pt-6 font-mono text-sm text-muted md:px-7">view: {v}</p>
          <DesignCheckBody />
          {v === 'board' ? <BoardPieces /> : <AnalystPieces />}
        </div>
      ))}
    </>
  );
}
