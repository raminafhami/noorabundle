import { Module } from '@nestjs/common';
import { SeederService } from './seeder.service';
import { IndustryModule } from '../industry/industry.module';
import { ProjectModule } from '../project/project.module';
import { CategoryModule } from '../categories/category.module';
import { InspectionCostsModule } from '../inspection-costs/inspection-costs.module';

@Module({
  imports: [
    IndustryModule,
    ProjectModule,
    CategoryModule,
    InspectionCostsModule,
  ],
  providers: [SeederService],
  exports: [SeederService],
})
export class SeederModule {}
