import { Controller, Get, Header, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { PdfQuerySchema, PdfTemplate } from '@renawi/shared';
import { createZodDto } from 'nestjs-zod';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { Audited } from '../common/audit/audit.decorator';
import type { DocumentView } from '../documents/documents.service';
import { PdfService, type PdfRequester } from './pdf.service';

export class PdfQueryDto extends createZodDto(PdfQuerySchema) {}

const TEMPLATE_PARAM = {
  name: 'template',
  enum: [...PdfTemplate.options],
  description:
    'lease-contract | handover | return (lease id); deposit-receipt (DEPOSIT_IN / DEPOSIT_OUT ' +
    'ledger entry id); payment-confirmation (PAYMENT ledger entry id or deal payment id); ' +
    'sale-agreement | disclosure-form (SALE / CONSIGNMENT_SALE deal id); purchase-agreement ' +
    '(PURCHASE deal id); consignment-agreement (CONSIGNED inventory cycle id)',
};

function requester(user: AuthenticatedUser | undefined): PdfRequester {
  return { userId: user?.id ?? null, locale: user?.locale ?? null };
}

@ApiTags('pdf')
@ApiCookieAuth()
@Controller('pdf')
export class PdfController {
  constructor(private readonly pdf: PdfService) {}

  @Post(':template/:id')
  @HttpCode(HttpStatus.CREATED)
  @Audited('Document', { idFromResult: true, action: 'CREATE' })
  @ApiParam(TEMPLATE_PARAM)
  @ApiOperation({
    summary:
      'Render a printable PDF (A4, Hebrew / Arabic / English, Chromium) and store it as a new ' +
      'Document on the owner record: contract (lease-contract, handover, return), ledger entry ' +
      '(deposit-receipt, payment-confirmation of a ledger payment), deal (sale / purchase ' +
      'agreement, disclosure form, payment-confirmation of a deal payment) or vehicle ' +
      '(consignment-agreement). Kind CONTRACT | HANDOVER | RECEIPT | AGREEMENT | ' +
      'DISCLOSURE_FORM, `lang` and a translated `title`; regenerating creates another Document. ' +
      'lang: he | ar | en (default: the counterparty preferredLang, else the user locale). ' +
      'Returns the Document (download at `url`).',
  })
  @ApiNotFoundResponse({ description: 'errors.notFound (unknown template or entity)' })
  @ApiConflictResponse({
    description: 'errors.pdfNotApplicable (template does not fit the entity)',
  })
  generate(
    @Param('template') template: string,
    @Param('id') id: string,
    @Query() query: PdfQueryDto,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<DocumentView> {
    return this.pdf.generate(template, id, query.lang, requester(user));
  }

  @Get(':template/:id/preview')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  @ApiParam(TEMPLATE_PARAM)
  @ApiProduces('text/html')
  @ApiOperation({
    summary:
      'The HTML the PDF is rendered from (same data, fonts embedded); for template work and ' +
      'tests. Same template / id / lang rules and errors as POST.',
  })
  @ApiNotFoundResponse({ description: 'errors.notFound' })
  @ApiConflictResponse({ description: 'errors.pdfNotApplicable' })
  preview(
    @Param('template') template: string,
    @Param('id') id: string,
    @Query() query: PdfQueryDto,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<string> {
    return this.pdf.preview(template, id, query.lang, requester(user));
  }
}
