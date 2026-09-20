import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PackagesService } from './packages.service';
import { PreviewPackageQuoteDto } from './dto/preview-package-quote.dto';
import { PackageRegionQueryDto } from './dto/package-region-query.dto';

@ApiTags('packages')
@Controller()
export class PackagesController {
  constructor(private readonly packages: PackagesService) {}

  @Get('packages')
  listPackages(@Query() query: PackageRegionQueryDto) {
    return this.packages.listPackages(query.regionId);
  }

  @Get('packages/:id/active-version')
  getActiveVersion(@Param('id') id: string) {
    return this.packages.getActiveVersion(id);
  }

  @Get('package-versions/:id/configuration')
  getConfiguration(
    @Param('id') id: string,
    @Query() query: PackageRegionQueryDto,
  ) {
    return this.packages.getConfiguration(id, query.regionId);
  }

  @Post('package-versions/:id/preview-quote')
  previewQuote(
    @Param('id') id: string,
    @Body() dto: PreviewPackageQuoteDto,
  ) {
    return this.packages.previewQuote(id, dto);
  }

}
