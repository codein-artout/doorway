import type { NextConfig } from 'next';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');

const config: NextConfig = {
  transpilePackages: ['@doorway/engine', '@doorway/content', '@doorway/bots', '@doorway/sim'],
  // spec/cards.json and reports/data/summary.json live at the repo root
  turbopack: { root },
  outputFileTracingRoot: root,
  typedRoutes: false,
  devIndicators: false,
};

export default config;
