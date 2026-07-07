import {
  Controller,
  Get,
  Param,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import type { Response } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { StorageService, UploadedImage } from './storage.service';

@ApiTags('storage')
@Controller()
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Post('admin/uploads/images')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseGuards(AdminAuthGuard, RolesGuard)
  @Roles(AdminRole.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  upload(@UploadedFile() file?: UploadedImage) {
    return this.storage.uploadImage(file);
  }

  @Post('admin/uploads/menu-images')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseGuards(AdminAuthGuard, RolesGuard)
  @Roles(AdminRole.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  uploadLegacy(@UploadedFile() file?: UploadedImage) {
    return this.storage.uploadImage(file);
  }

  @Get('uploads/images/:filename')
  async localImage(
    @Param('filename') filename: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return new StreamableFile(await this.storage.localFile(filename));
  }

  @Get('uploads/menu/:filename')
  async legacyMenuImage(
    @Param('filename') filename: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return new StreamableFile(await this.storage.legacyMenuFile(filename));
  }
}
