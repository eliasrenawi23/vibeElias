import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { SettingsModule } from '../settings/settings.module';
import { PdfController } from './pdf.controller';
import { PdfRenderer } from './pdf-renderer.service';
import { PdfService } from './pdf.service';

/**
 * Generated PDFs (lease contract, handover / return checklists, deposit receipt, payment
 * confirmation, sale / purchase / consignment agreements, disclosure form) in he / ar / en.
 */
@Module({
  imports: [DocumentsModule, SettingsModule],
  controllers: [PdfController],
  providers: [PdfService, PdfRenderer],
  exports: [PdfService, PdfRenderer],
})
export class PdfModule {}
