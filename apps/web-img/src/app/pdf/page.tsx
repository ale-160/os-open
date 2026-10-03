import PdfMainPage from '@/components/layout/PdfMainPage';
import { Metadata } from 'next';
import { getPdfMetadata } from '@/config/metadata';
import { StructuredDataScript } from '@/components/ui/StructuredDataScript';
import { ClientProviders } from '@/components/providers/ClientProviders';

export const metadata: Metadata = getPdfMetadata('en');

export default function PdfPage() {
  return (
    <ClientProviders lang="en">
      <StructuredDataScript lang="en" />
      <PdfMainPage lang="en" />
    </ClientProviders>
  );
}
