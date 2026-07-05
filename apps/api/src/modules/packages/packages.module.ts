import { Module } from '@nestjs/common';
import { AdminPackagesController } from './admin-packages.controller';
import { PackagesController } from './packages.controller';
import { PackagesService } from './packages.service';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [PricingModule],
  controllers: [PackagesController, AdminPackagesController],
  providers: [PackagesService],
})
export class PackagesModule {}
