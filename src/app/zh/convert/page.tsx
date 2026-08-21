import ConvertMainPage from '@/components/layout/ConvertMainPage';
import { Metadata } from 'next';
import { getConvertMetadata } from '@/config/metadata';
import { StructuredDataScript } from '@/components/ui/StructuredDataScript';
import { ClientProviders } from '@/components/providers/ClientProviders';

export const metadata: Metadata = getConvertMetadata('zh');

export default function ZhConvertPage() {
  return (
    <ClientProviders lang="zh">
      <StructuredDataScript lang="zh" />
      <ConvertMainPage lang="zh" />
    </ClientProviders>
  );
}
