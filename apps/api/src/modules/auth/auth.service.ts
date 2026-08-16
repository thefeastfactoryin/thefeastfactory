import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '@prisma/client';
import bcrypt from 'bcrypt';
import { randomInt } from 'node:crypto';
import { JwtPayload } from '../../common/auth/jwt-payload';
import { positiveIntegerSetting } from '../../common/setting-values';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ConsoleOtpProvider } from './providers/console-otp.provider';

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly otpProvider: ConsoleOtpProvider,
    private readonly prisma: PrismaService,
  ) {}

  async requestCustomerOtp(dto: RequestOtpDto) {
    const otp = this.testOtpFor(dto.mobileNumber) ?? this.generateOtp();
    const otpHash = await bcrypt.hash(
      otp,
      this.config.get<number>('BCRYPT_SALT_ROUNDS', 12),
    );
    const expirySeconds = await this.getIntSetting(
      'otp_expiry_seconds',
      this.config.get<number>('MSG91_OTP_EXPIRY_SECONDS', 300),
    );

    const otpRecord = await this.prisma.otpVerification.create({
      data: {
        mobileNumber: dto.mobileNumber,
        otpHash,
        expiresAt: new Date(Date.now() + expirySeconds * 1000),
      },
    });

    try {
      await this.otpProvider.sendOtp(dto.mobileNumber, otp);
    } catch (error) {
      // Do not let an undelivered resend shadow the last OTP the customer
      // actually received.
      await this.prisma.otpVerification.delete({
        where: { id: otpRecord.id },
      });
      throw error;
    }

    return {
      success: true,
      expiresInSeconds: expirySeconds,
      message: 'OTP sent',
    };
  }

  private testOtpFor(mobileNumber: string) {
    if (!this.config.get<boolean>('TEST_LOGIN_OTP_ENABLED', false)) {
      return undefined;
    }

    const testMobile = this.config.get<string>('TEST_LOGIN_MOBILE', '');
    if (!testMobile || mobileNumber !== testMobile) {
      return undefined;
    }

    return this.config.get<string>('TEST_LOGIN_OTP') || undefined;
  }

  async verifyCustomerOtp(dto: VerifyOtpDto) {
    const otpRecord = await this.prisma.otpVerification.findFirst({
      where: {
        mobileNumber: dto.mobileNumber,
        isVerified: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    const maxAttempts = await this.getIntSetting('otp_max_attempts', 5);
    if (otpRecord.attempts >= maxAttempts) {
      throw new UnauthorizedException('Maximum OTP attempts exceeded');
    }

    const isValid = await bcrypt.compare(dto.otp, otpRecord.otpHash);
    if (!isValid) {
      await this.prisma.otpVerification.updateMany({
        where: {
          id: otpRecord.id,
          isVerified: false,
          expiresAt: { gt: new Date() },
          attempts: { lt: maxAttempts },
        },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    const user = await this.prisma.$transaction(async (transaction) => {
      const claimed = await transaction.otpVerification.updateMany({
        where: {
          id: otpRecord.id,
          isVerified: false,
          expiresAt: { gt: new Date() },
          attempts: { lt: maxAttempts },
        },
        data: { isVerified: true },
      });
      if (claimed.count !== 1) {
        throw new UnauthorizedException('Invalid or expired OTP');
      }
      return transaction.user.upsert({
        where: { mobileNumber: dto.mobileNumber },
        update: { isActive: true, deletedAt: null },
        create: { mobileNumber: dto.mobileNumber },
      });
    });

    return this.createCustomerSession(user);
  }

  async loginAdmin(dto: AdminLoginDto) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { region: true },
    });

    if (!admin?.isActive) {
      throw new UnauthorizedException('Invalid admin credentials');
    }

    const isValid = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid admin credentials');
    }

    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const payload: JwtPayload = {
      sub: admin.id,
      type: 'admin',
      role: admin.role,
      regionId: admin.regionId,
    };
    const tokens = await this.signTokens(payload);

    return {
      ...tokens,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        regionId: admin.regionId,
        region: admin.region ? this.serializeRegion(admin.region) : null,
      },
    };
  }

  async refresh(refreshToken: string, expectedType: 'customer' | 'admin') {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== expectedType) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type === 'customer') {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });
      if (!user?.isActive || user.deletedAt) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      return this.createCustomerSession(user);
    }

    const admin = await this.prisma.adminUser.findUnique({
      where: { id: payload.sub },
      include: { region: true },
    });
    if (!admin?.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = await this.signTokens({
      sub: admin.id,
      type: 'admin',
      role: admin.role,
      regionId: admin.regionId,
    });
    return {
      ...tokens,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        regionId: admin.regionId,
        region: admin.region ? this.serializeRegion(admin.region) : null,
      },
    };
  }

  private async createCustomerSession(user: User) {
    const payload: JwtPayload = { sub: user.id, type: 'customer' };
    const tokens = await this.signTokens(payload);

    return {
      ...tokens,
      user: {
        id: user.id,
        mobileNumber: user.mobileNumber,
        name: user.name,
        email: user.email,
      },
    };
  }

  private async signTokens(payload: JwtPayload) {
    const accessExpiresIn = this.config.get<string>(
      'JWT_ACCESS_EXPIRES_IN',
      '15m',
    ) as never;
    const refreshExpiresIn = this.config.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '30d',
    ) as never;

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: accessExpiresIn,
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiresIn,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private generateOtp() {
    return String(randomInt(100000, 1_000_000));
  }

  private async getIntSetting(key: string, fallback: number) {
    const setting = await this.prisma.platformSetting.findUnique({
      where: { key },
    });
    return positiveIntegerSetting(setting?.value, fallback);
  }

  private serializeRegion(region: Prisma.OperatingRegionGetPayload<object>) {
    return {
      ...region,
      centerLatitude: region.centerLatitude.toFixed(8),
      centerLongitude: region.centerLongitude.toFixed(8),
      serviceRadiusKm: region.serviceRadiusKm.toFixed(2),
      deliveryFeePerKm: region.deliveryFeePerKm.toFixed(2),
    };
  }
}
