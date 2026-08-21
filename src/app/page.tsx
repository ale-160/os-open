import MainPage from '@/components/layout/MainPage';
import ClientRedirect from '@/components/seo/ClientRedirect';
import { Metadata } from 'next';
import { getMetadata } from '@/config/metadata';
import { StructuredDataScript } from '@/components/ui/StructuredDataScript';
import { ClientProviders } from '@/components/providers/ClientProviders';

export const metadata: Metadata = getMetadata('en');

export default function EnglishPage() {
  return (
    <ClientProviders lang="en">
      <StructuredDataScript lang="en" />
      <ClientRedirect />
      <MainPage lang="en" />
    </ClientProviders>
  );
}
