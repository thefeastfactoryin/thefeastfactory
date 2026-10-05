import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { AuthService } from './auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('customer/request-otp')
  @HttpCode(200)
  @RateLimit(
    {
      name: 'otp-request-short',
      identity: 'mobileNumber',
      limit: 3,
      windowSeconds: 600,
    },
    {
      name: 'otp-request-daily',
      identity: 'mobileNumber',
      limit: 10,
      windowSeconds: 86_400,
    },
    {
      name: 'otp-request-ip-short',
      identity: 'ip',
      limit: 10,
      windowSeconds: 600,
    },
    {
      name: 'otp-request-ip-daily',
      identity: 'ip',
      limit: 50,
      windowSeconds: 86_400,
    },
  )
  @UseGuards(RateLimitGuard)
  requestCustomerOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestCustomerOtp(dto);
  }

  @Post('customer/verify-otp')
  @HttpCode(200)
  @RateLimit(
    {
      name: 'otp-verify',
      identity: 'mobileNumber',
      limit: 5,
      windowSeconds: 600,
    },
    { name: 'otp-verify-ip', identity: 'ip', limit: 5, windowSeconds: 600 },
  )
  @UseGuards(RateLimitGuard)
  verifyCustomerOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyCustomerOtp(dto);
  }

  @Post('customer/refresh')
  @HttpCode(200)
  @RateLimit(
    {
      name: 'customer-refresh',
      identity: 'refreshToken',
      limit: 30,
      windowSeconds: 60,
    },
    {
      name: 'customer-refresh-ip',
      identity: 'ip',
      limit: 30,
      windowSeconds: 60,
    },
  )
  @UseGuards(RateLimitGuard)
  refreshCustomer(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto.refreshToken, 'customer');
  }

  @Post('customer/logout')
  @HttpCode(204)
  logoutCustomer() {
    return undefined;
  }

  @Post('admin/login')
  @HttpCode(200)
  @RateLimit(
    { name: 'admin-login', identity: 'email', limit: 5, windowSeconds: 900 },
    { name: 'admin-login-ip', identity: 'ip', limit: 20, windowSeconds: 900 },
  )
  @UseGuards(RateLimitGuard)
  loginAdmin(@Body() dto: AdminLoginDto) {
    return this.auth.loginAdmin(dto);
  }

  @Post('admin/refresh')
  @HttpCode(200)
  @RateLimit(
    {
      name: 'admin-refresh',
      identity: 'refreshToken',
      limit: 30,
      windowSeconds: 60,
    },
    { name: 'admin-refresh-ip', identity: 'ip', limit: 30, windowSeconds: 60 },
  )
  @UseGuards(RateLimitGuard)
  refreshAdmin(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto.refreshToken, 'admin');
  }

  @Post('admin/logout')
  @HttpCode(204)
  logoutAdmin() {
    return undefined;
  }
}
