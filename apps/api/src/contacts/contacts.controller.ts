import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ContactArchiveSchema, type Paginated } from '@renawi/shared';
import { Audited } from '../common/audit/audit.decorator';
import { parseOptionalBody } from '../common/zod-body';
import { ContactDetail, ContactListItem, ContactsService } from './contacts.service';
import { ContactCreateDto, ContactQueryDto, ContactUpdateDto } from './dto';

@ApiTags('contacts')
@ApiCookieAuth()
@Audited('Contact')
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Paginated contacts. q matches name / company / phone / ID / email (every word must match); ' +
      'tag = any of the tags; archived=false (default) active only, true archived only',
  })
  list(@Query() query: ContactQueryDto): Promise<Paginated<ContactListItem>> {
    return this.contacts.list(query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a contact (duplicate idNumber -> 409 validation.duplicate)' })
  create(@Body() dto: ContactCreateDto): Promise<ContactDetail> {
    return this.contacts.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Contact + driver { id, status } | null + counts { deals, documents }' })
  get(@Param('id') id: string): Promise<ContactDetail> {
    return this.contacts.get(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Partial update (a name must remain)' })
  update(@Param('id') id: string, @Body() dto: ContactUpdateDto): Promise<ContactDetail> {
    return this.contacts.update(id, dto);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive the contact (optional body { archived: false } restores)' })
  @ApiBody({ required: false, schema: { properties: { archived: { type: 'boolean' } } } })
  archive(@Param('id') id: string, @Body() body: unknown): Promise<ContactDetail> {
    const { archived } = parseOptionalBody(ContactArchiveSchema, body);
    return this.contacts.setArchived(id, archived);
  }

  @Post(':id/unarchive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore an archived contact' })
  unarchive(@Param('id') id: string): Promise<ContactDetail> {
    return this.contacts.setArchived(id, false);
  }
}
