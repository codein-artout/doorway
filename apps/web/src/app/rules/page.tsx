import { DEFAULT_RULESET } from '@doorway/content';
import { RulesReference } from '@/components/rules-ref';
import { SiteNav } from '@/components/site-nav';

export const metadata = { title: 'Rules' };

export default function Rules() {
  return (
    <div className="mx-auto max-w-[1100px] pb-10">
      <SiteNav />
      <main className="px-4 pt-6 md:px-7">
        <h1 className="m-0 font-display text-[40px] font-extrabold">Rules, quickly</h1>
        <p className="text-muted">
          Doorway v0.2. Each life ends at the same Doorway; it only lets you carry one stretch of your life
          through.
        </p>
        <section className="rounded-2xl border border-line bg-surface-2 px-[18px] py-4">
          <RulesReference r={DEFAULT_RULESET} players={4} />
        </section>
        <h2 className="mt-6 font-display text-xl">Solo challenge</h2>
        <p>
          Allowance {DEFAULT_RULESET.solo.doorway}. Rush moves {DEFAULT_RULESET.solo.rush}. At the end of each
          of your turns the leftmost card of each row is discarded and the rest slide left. Ratings: under 25
          A quiet life · 25–34 A good life · 35–44 A full life · 45+ Everything you could bring.
        </p>
      </main>
    </div>
  );
}
