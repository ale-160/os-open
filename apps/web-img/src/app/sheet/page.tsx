import SheetMainPage from '@/components/layout/SheetMainPage';
import { Metadata } from 'next';
import { getSheetMetadata } from '@/config/metadata';
import { StructuredDataScript } from '@/components/ui/StructuredDataScript';
import { ClientProviders } from '@/components/providers/ClientProviders';

export const metadata: Metadata = getSheetMetadata('zh');

export default function SheetPage() {
  return (
    <ClientProviders lang="zh">
      <StructuredDataScript lang="zh" />
      <SheetMainPage />
    </ClientProviders>
  );
}
