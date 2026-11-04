import { Body, Controller, Headers, Ip, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ZodValidationPipe } from '../common/zod.pipe';
import { CurrentUser, Public, type AuthenticatedUser } from '../common/decorators';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import {
  loginSchema,
  mfaVerifySchema,
  refreshSchema,
  registerSchema,
  type LoginDto,
  type MfaVerifyDto,
  type RefreshDto,
  type RegisterDto,
} from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  register(
    @Body(new ZodValidationPipe(registerSchema)) dto: RegisterDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.auth.register(dto, { ip, userAgent });
  }

  @Public()
  @Post('login')
  login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.auth.login(dto, { ip, userAgent });
  }

  @Public()
  @Post('refresh')
  refresh(
    @Body(new ZodValidationPipe(refreshSchema)) dto: RefreshDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.auth.refresh(dto.refreshToken, { ip, userAgent });
  }

  @Public()
  @Post('logout')
  logout(@Body(new ZodValidationPipe(refreshSchema)) dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  logoutAll(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.logoutAll(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('mfa/begin')
  beginMfa(@CurrentUser() user: AuthenticatedUser, @Headers('x-user-email') email: string) {
    // email is looked up server-side in production; header kept for the demo flow
    return this.auth.beginMfaEnrollment(user.userId, email ?? 'user');
  }

  @UseGuards(JwtAuthGuard)
  @Post('mfa/confirm')
  confirmMfa(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(mfaVerifySchema)) dto: MfaVerifyDto,
  ) {
    return this.auth.confirmMfaEnrollment(user.userId, dto.totp);
  }
}
