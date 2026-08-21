import PdfMainPage from '@/components/layout/PdfMainPage';
import { Metadata } from 'next';
import { getPdfMetadata } from '@/config/metadata';
import { StructuredDataScript } from '@/components/ui/StructuredDataScript';
import { ClientProviders } from '@/components/providers/ClientProviders';

export const metadata: Metadata = getPdfMetadata('zh');

export default function ZhPdfPage() {
  return (
    <ClientProviders lang="zh">
      <StructuredDataScript lang="zh" />
      <PdfMainPage lang="zh" />
    </ClientProviders>
  );
}
