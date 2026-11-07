import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { Paginated } from '@renawi/shared';
import { Roles } from '../auth/decorators';
import { Audited } from '../common/audit/audit.decorator';
import { UserCreateDto, UserQueryDto, UserUpdateDto } from './dto';
import { UsersService, UserView } from './users.service';

/** Staff user management (ADMIN only). Single owner in v1; ready for staff accounts. */
@ApiTags('users')
@ApiCookieAuth()
@Roles('ADMIN')
@Audited('User')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Query() query: UserQueryDto): Promise<Paginated<UserView>> {
    return this.users.list(query);
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<UserView> {
    return this.users.toView(await this.users.getById(id));
  }

  @Post()
  create(@Body() dto: UserCreateDto): Promise<UserView> {
    return this.users.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UserUpdateDto): Promise<UserView> {
    return this.users.update(id, dto);
  }
}
