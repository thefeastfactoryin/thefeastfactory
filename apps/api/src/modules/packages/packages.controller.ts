import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PackagesService } from './packages.service';

@ApiTags('packages')
@Controller()
export class PackagesController {
  constructor(private readonly packages: PackagesService) {}

  @Get('packages')
  listPackages() {
    return this.packages.listPackages();
  }

  @Get('packages/:id/active-version')
  getActiveVersion(@Param('id') id: string) {
    return this.packages.getActiveVersion(id);
  }

  @Get('package-versions/:id/configuration')
  getConfiguration(@Param('id') id: string) {
    return this.packages.getConfiguration(id);
  }

}
