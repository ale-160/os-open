import ConvertMainPage from '@/components/layout/ConvertMainPage';
import { Metadata } from 'next';
import { getConvertMetadata } from '@/config/metadata';
import { StructuredDataScript } from '@/components/ui/StructuredDataScript';
import { ClientProviders } from '@/components/providers/ClientProviders';

export const metadata: Metadata = getConvertMetadata('en');

export default function ConvertPage() {
  return (
    <ClientProviders lang="en">
      <StructuredDataScript lang="en" />
      <ConvertMainPage lang="en" />
    </ClientProviders>
  );
}
