import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { AdminOrdersModule } from './modules/admin-orders/admin-orders.module';
import { MenuModule } from './modules/menu/menu.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PackagesModule } from './modules/packages/packages.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ReportsModule } from './modules/reports/reports.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './modules/storage/storage.module';
import { OperationsModule } from './modules/operations/operations.module';
import { OperatingRegionsModule } from './modules/operating-regions/operating-regions.module';
import { CartModule } from './modules/cart/cart.module';
import { CatalogModule } from './modules/catalog/catalog.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    MenuModule,
    PackagesModule,
    OrdersModule,
    PaymentsModule,
    AdminOrdersModule,
    ReportsModule,
    StorageModule,
    OperationsModule,
    OperatingRegionsModule,
    CartModule,
    CatalogModule,
  ],
})
export class AppModule {}
