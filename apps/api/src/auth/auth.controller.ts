import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { AuthSession } from '@renawi/shared';
import type { Request, Response } from 'express';
import { Audited } from '../common/audit/audit.decorator';
import type { Env } from '../config/env';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './auth.constants';
import { AuthService } from './auth.service';
import type { AuthenticatedUser, IssuedSession } from './auth.types';
import { clearAuthCookies, setAuthCookies } from './cookies';
import { CurrentUser, Public } from './decorators';
import { LoginDto, MeUpdateDto } from './dto';
import { TokenService } from './token.service';

function cookie(req: Request, name: string): string | undefined {
  const value = (req.cookies as Record<string, unknown> | undefined)?.[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly secureCookies: boolean;

  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
    config: ConfigService<Env, true>,
  ) {
    this.secureCookies = config.get('COOKIE_SECURE', { infer: true });
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in; sets the rm_access and rm_refresh httpOnly cookies' })
  @ApiOkResponse({ description: '{ user }' })
  @ApiUnauthorizedResponse({
    description: "{ statusCode: 401, message: 'auth.invalidCredentials' }",
  })
  @ApiTooManyRequestsResponse({ description: 'More than LOGIN_THROTTLE_LIMIT attempts per minute' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSession> {
    return this.respond(res, await this.auth.login(dto));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate the refresh cookie and issue a new access cookie' })
  @ApiUnauthorizedResponse({ description: "{ statusCode: 401, message: 'auth.sessionExpired' }" })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSession> {
    return this.respond(res, await this.auth.refresh(cookie(req, REFRESH_COOKIE)));
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Clear both cookies and end all sessions of the user' })
  @ApiNoContentResponse()
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout({
      accessToken: cookie(req, ACCESS_COOKIE),
      refreshToken: cookie(req, REFRESH_COOKIE),
    });
    clearAuthCookies(res, this.secureCookies);
  }

  @Get('me')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Current user' })
  me(@CurrentUser() user: AuthenticatedUser): AuthSession {
    const { tokenVersion: _tokenVersion, ...publicUser } = user;
    return { user: publicUser };
  }

  @Patch('me')
  @ApiCookieAuth()
  @Audited('User', { idFromUser: true })
  @ApiOperation({ summary: 'Update locale / theme / name, or change the password' })
  async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MeUpdateDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSession> {
    const result = await this.auth.updateMe(user, dto);
    if (result.session) return this.respond(res, result.session);
    return { user: result.user };
  }

  private respond(res: Response, session: IssuedSession): AuthSession {
    setAuthCookies(res, session, {
      secure: this.secureCookies,
      accessMaxAgeMs: this.tokens.accessTtlMs,
      refreshMaxAgeMs: this.tokens.refreshTtlMs,
    });
    return { user: session.user };
  }
}
