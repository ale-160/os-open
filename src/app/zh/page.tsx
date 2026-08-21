import MainPage from '@/components/layout/MainPage';
import { Metadata } from 'next';
import { getMetadata } from '@/config/metadata';
import { StructuredDataScript } from '@/components/ui/StructuredDataScript';
import { ClientProviders } from '@/components/providers/ClientProviders';

export const metadata: Metadata = getMetadata('zh');

export default function ZhPage() {
  return (
    <ClientProviders lang="zh">
      <StructuredDataScript lang="zh" />
      <MainPage lang="zh" />
    </ClientProviders>
  );
}
