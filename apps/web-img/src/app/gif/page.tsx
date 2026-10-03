import GifMakerPage from '@/components/layout/GifMakerPage';
import { Metadata } from 'next';
import { getGifMakerMetadata } from '@/config/metadata';
import { StructuredDataScript } from '@/components/ui/StructuredDataScript';
import { ClientProviders } from '@/components/providers/ClientProviders';

export const metadata: Metadata = getGifMakerMetadata('en');

export default function GifPage() {
  return (
    <ClientProviders lang="en">
      <StructuredDataScript lang="en" />
      <GifMakerPage lang="en" />
    </ClientProviders>
  );
}
