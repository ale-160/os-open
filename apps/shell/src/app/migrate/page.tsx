import type { Metadata } from 'next';
import MigrateClient from './MigrateClient';

export const metadata: Metadata = {
  title: 'Ale OS · 数据迁移',
  robots: { index: false, follow: false }
};

export default function MigratePage() {
  return <MigrateClient />;
}
