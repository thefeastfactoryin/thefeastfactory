import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, isActive: true, deletedAt: null },
      select: { id: true, mobileNumber: true, name: true, email: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    await this.getProfile(userId);

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
      },
      select: { id: true, mobileNumber: true, name: true, email: true },
    });
  }

  async listAddresses(userId: string) {
    await this.getProfile(userId);

    const addresses = await this.prisma.userAddress.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return addresses.map((address) => ({
      ...address,
      latitude: address.latitude?.toString() ?? null,
      longitude: address.longitude?.toString() ?? null,
    }));
  }

  async createAddress(userId: string, dto: CreateAddressDto) {
    await this.getProfile(userId);

    return this.prisma.$transaction(async (tx) => {
      const shouldSetDefault =
        dto.isDefault ??
        (await tx.userAddress.count({ where: { userId } })) === 0;

      if (shouldSetDefault) {
        await tx.userAddress.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
      }

      const address = await tx.userAddress.create({
        data: this.toAddressCreateInput(userId, dto, shouldSetDefault),
      });

      return {
        ...address,
        latitude: address.latitude?.toString() ?? null,
        longitude: address.longitude?.toString() ?? null,
      };
    });
  }

  async updateAddress(
    userId: string,
    addressId: string,
    dto: UpdateAddressDto,
  ) {
    await this.assertAddressOwner(userId, addressId);

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.userAddress.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
      }

      const address = await tx.userAddress.update({
        where: { id: addressId },
        data: this.toAddressUpdateInput(dto),
      });

      return {
        ...address,
        latitude: address.latitude?.toString() ?? null,
        longitude: address.longitude?.toString() ?? null,
      };
    });
  }

  async deleteAddress(userId: string, addressId: string) {
    const address = await this.assertAddressOwner(userId, addressId);
    const [cartReferences, orderReferences] = await Promise.all([
      this.prisma.cart.count({ where: { addressId } }),
      this.prisma.order.count({ where: { addressId } }),
    ]);
    if (cartReferences > 0 || orderReferences > 0) {
      throw new ConflictException(
        'This address is used by a cart or order and cannot be deleted',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userAddress.delete({ where: { id: address.id } });

      if (!address.isDefault) return;
      const nextAddress = await tx.userAddress.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      if (nextAddress) {
        await tx.userAddress.update({
          where: { id: nextAddress.id },
          data: { isDefault: true },
        });
      }
    });

    return { success: true };
  }

  async setDefaultAddress(userId: string, addressId: string) {
    await this.assertAddressOwner(userId, addressId);

    await this.prisma.$transaction([
      this.prisma.userAddress.updateMany({
        where: { userId },
        data: { isDefault: false },
      }),
      this.prisma.userAddress.update({
        where: { id: addressId },
        data: { isDefault: true },
      }),
    ]);

    return { success: true };
  }

  private async assertAddressOwner(userId: string, addressId: string) {
    const address = await this.prisma.userAddress.findFirst({
      where: { id: addressId, userId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    return address;
  }

  private toAddressCreateInput(
    userId: string,
    dto: CreateAddressDto,
    isDefault: boolean,
  ): Prisma.UserAddressUncheckedCreateInput {
    return {
      userId,
      addressType: dto.addressType,
      label: dto.label,
      addressLine1: dto.addressLine1,
      addressLine2: dto.addressLine2,
      city: dto.city,
      state: dto.state,
      pincode: dto.pincode,
      landmark: dto.landmark,
      latitude: dto.latitude ? new Prisma.Decimal(dto.latitude) : undefined,
      longitude: dto.longitude ? new Prisma.Decimal(dto.longitude) : undefined,
      isDefault,
    };
  }

  private toAddressUpdateInput(
    dto: UpdateAddressDto,
  ): Prisma.UserAddressUncheckedUpdateInput {
    return {
      ...(dto.addressType !== undefined
        ? { addressType: dto.addressType }
        : {}),
      ...(dto.label !== undefined ? { label: dto.label } : {}),
      ...(dto.addressLine1 !== undefined
        ? { addressLine1: dto.addressLine1 }
        : {}),
      ...(dto.addressLine2 !== undefined
        ? { addressLine2: dto.addressLine2 }
        : {}),
      ...(dto.city !== undefined ? { city: dto.city } : {}),
      ...(dto.state !== undefined ? { state: dto.state } : {}),
      ...(dto.pincode !== undefined ? { pincode: dto.pincode } : {}),
      ...(dto.landmark !== undefined ? { landmark: dto.landmark } : {}),
      ...(dto.latitude !== undefined
        ? { latitude: dto.latitude ? new Prisma.Decimal(dto.latitude) : null }
        : {}),
      ...(dto.longitude !== undefined
        ? {
            longitude: dto.longitude ? new Prisma.Decimal(dto.longitude) : null,
          }
        : {}),
      // A default can be replaced by setting another address as default, but
      // never unset directly and leave the customer with no default address.
      ...(dto.isDefault === true ? { isDefault: true } : {}),
    };
  }
}
