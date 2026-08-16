import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../../common/auth/jwt-payload';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (payload.type === 'customer') {
      const user = await this.prisma.user.findFirst({
        where: { id: payload.sub, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (!user) throw new UnauthorizedException('Account is not active');
      return payload;
    }

    const admin = await this.prisma.adminUser.findFirst({
      where: { id: payload.sub, isActive: true },
      select: { role: true, regionId: true },
    });
    if (!admin) throw new UnauthorizedException('Account is not active');
    return { ...payload, role: admin.role, regionId: admin.regionId };
  }
}
