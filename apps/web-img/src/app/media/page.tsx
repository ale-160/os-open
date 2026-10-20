import MediaMainPage from '@/components/layout/MediaMainPage';
import { Metadata } from 'next';
import { getMediaMetadata } from '@/config/metadata';
import { ClientProviders } from '@/components/providers/ClientProviders';

export const metadata: Metadata = getMediaMetadata('zh');

export default function MediaPage() {
  return (
    <ClientProviders lang="zh">
      <MediaMainPage />
    </ClientProviders>
  );
}
