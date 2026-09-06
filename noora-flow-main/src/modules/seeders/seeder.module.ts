import { Module } from '@nestjs/common';
import { SeederService } from './seeder.service';
import { IndustryModule } from '../industry/industry.module';
import { ProjectModule } from '../project/project.module';
import { CategoryModule } from '../categories/category.module';
import { InspectionCostsModule } from '../inspection-costs/inspection-costs.module';
import { UsersModule } from '../users/users.module';
import { UserGroupsModule } from '../user-groups/user-groups.module';
import { ProcessDefinitionsModule } from '../process-definitions/process-definitions.module';

@Module({
  imports: [
    IndustryModule,
    ProjectModule,
    CategoryModule,
    InspectionCostsModule,
    UsersModule,
    UserGroupsModule,
    ProcessDefinitionsModule,
  ],
  providers: [SeederService],
  exports: [SeederService],
})
export class SeederModule {}
