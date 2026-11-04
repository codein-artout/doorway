import { z } from 'zod';
import { validateRuleset as semanticRulesetProblems } from '@doorway/engine';
import type { Card, Ruleset } from '@doorway/engine';

export const DomainSchema = z.enum(['pink', 'gold', 'green', 'orange', 'purple']);
export const AgeSchema = z.enum(['young', 'middle', 'old']);

export const PowerSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('discount'),
    color: DomainSchema,
    amount: z.number().int().positive(),
    text: z.string().optional(),
  }),
  z.object({
    type: z.literal('rush_bonus'),
    amount: z.number().int().positive(),
    text: z.string().optional(),
  }),
  z.object({ type: z.literal('age_reach_once'), text: z.string().optional() }),
  z.object({ type: z.literal('ignore_requirement_once'), text: z.string().optional() }),
  z.object({ type: z.literal('swap_now'), text: z.string().optional() }),
  z.object({
    type: z.literal('next_quest_discount'),
    amount: z.number().int().positive(),
    text: z.string().optional(),
  }),
  z.object({
    type: z.literal('doorway_bonus'),
    amount: z.number().int().positive(),
    text: z.string().optional(),
  }),
]);

export const CardSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: DomainSchema,
  age: AgeSchema,
  years: z.number().int().min(0),
  points: z.number().int(),
  requires: z.object({ color: DomainSchema, count: z.number().int().positive() }).nullable(),
  power: PowerSchema.nullable(),
  reflection: DomainSchema.nullable(),
});

export const CardsFileSchema = z.object({
  version: z.string(),
  colors: z.record(z.string(), z.object({ domain: z.string(), icon: z.string() })),
  cards: z.array(CardSchema),
});

const band = z.tuple([z.number().int(), z.number().int()]);
export const RulesetSchema = z.object({
  id: z.string().min(1),
  trackLength: z.number().int(),
  ageBands: z.object({ young: band, middle: band, old: band }),
  milestones: z.array(z.number().int()),
  market: z.object({ young: z.number().int(), middle: z.number().int(), old: z.number().int() }),
  experienceStep: z.number().int(),
  experienceCap: z.number().int(),
  minCost: z.number().int(),
  rushNoPawnAhead: z.number().int(),
  rushDiscard: z.boolean(),
  doorway: z.record(z.string(), z.array(z.number().int())),
  fullLifeBonus: z.number(),
  passion: z.record(z.string(), z.number()),
  reflectionPerDisc: z.number(),
  solo: z.object({ doorway: z.number().int(), rush: z.number().int() }),
  hints: z.object({ bestWindow: z.boolean() }),
  cardsFile: z.string(),
});

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const zodErrors = (e: z.ZodError) => e.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);

/** R43: structural (zod) + semantic checks. Never throws; returns readable errors. */
export function validateRuleset(input: unknown): ValidationResult<Ruleset> {
  const parsed = RulesetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };
  const problems = semanticRulesetProblems(parsed.data);
  if (problems.length) return { ok: false, errors: problems };
  return { ok: true, value: parsed.data as Ruleset };
}

export type CardSetSummary = Record<'young' | 'middle' | 'old', number> & {
  byDomain: Record<string, number>;
  powers: number;
  reflections: number;
};

export function summarizeCards(cards: Card[]): CardSetSummary {
  const s: CardSetSummary = { young: 0, middle: 0, old: 0, byDomain: {}, powers: 0, reflections: 0 };
  for (const c of cards) {
    s[c.age]++;
    s.byDomain[c.color] = (s.byDomain[c.color] ?? 0) + 1;
    if (c.power) s.powers++;
    if (c.reflection) s.reflections++;
  }
  return s;
}

/** Card-set validation (build spec §11.2): schema, unique ids, all 5 domains, no Young requirements. */
export function validateCards(input: unknown): ValidationResult<Card[]> {
  const parsed = z.array(CardSchema).safeParse(input);
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };
  const cards = parsed.data as Card[];
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const c of cards) {
    if (seen.has(c.id)) errors.push(`Duplicate card id ${c.id}.`);
    seen.add(c.id);
    if (c.age === 'young' && c.requires) errors.push(`${c.id}: Young cards never have requirements.`);
  }
  const domains = new Set(cards.map((c) => c.color));
  for (const d of DomainSchema.options) if (!domains.has(d)) errors.push(`No cards of domain ${d}.`);
  for (const a of AgeSchema.options) if (!cards.some((c) => c.age === a)) errors.push(`No ${a} cards.`);
  return errors.length ? { ok: false, errors } : { ok: true, value: cards };
}
