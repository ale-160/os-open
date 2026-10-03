import GifMakerPage from '@/components/layout/GifMakerPage';
import { Metadata } from 'next';
import { getGifMakerMetadata } from '@/config/metadata';
import { StructuredDataScript } from '@/components/ui/StructuredDataScript';
import { ClientProviders } from '@/components/providers/ClientProviders';

export const metadata: Metadata = getGifMakerMetadata('zh');

export default function GifZhPage() {
  return (
    <ClientProviders lang="zh">
      <StructuredDataScript lang="zh" />
      <GifMakerPage lang="zh" />
    </ClientProviders>
  );
}
