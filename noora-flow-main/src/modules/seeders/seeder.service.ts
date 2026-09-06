import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { IndustryService } from '../industry/industry.service';
import {
  consumerSubIndustries,
  industries,
  productionSubIndustries,
  servicesSubIndustries,
  activityProject,
} from './seeder-data';
import { ProjectService } from '../project/project.service';
import { ProjectType } from 'src/common/const/enums';
import { CategoryService } from '../categories/category.service';
import { InspectionCostsService } from '../inspection-costs/inspection-costs.service';
import { GetQueryWithDownloadDto } from '../process-instances/dtos';
import { ObjectId } from 'mongodb';
import { UsersService } from '../users/services/users.service';
import { UserGroupsService } from '../user-groups/user-groups.service';
import {
  LoginTypes,
  UserTypes,
} from '../users/schemas/user.schema';
import { USER_GROUP_TYPE } from '../user-groups/schemas/user-group.schema';
import { ProcessDefinitionService } from '../process-definitions/process-definitions.service';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import * as convert from 'xml-js';

@Injectable()
export class SeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeederService.name);

  constructor(
    private readonly industryService: IndustryService,
    private readonly projectService: ProjectService,
    private readonly categoryService: CategoryService,
    private readonly inspectionCost: InspectionCostsService,
    private readonly usersService: UsersService,
    private readonly userGroupsService: UserGroupsService,
    private readonly processDefinitionService: ProcessDefinitionService,
  ) {}

  async onApplicationBootstrap() {
    await this.seedSuperAdmin();
    await this.runSeeder();
  }

  /**
   * Imports only approved BPMN files from statics/bpmn/active.
   * Existing process keys are left untouched, making startup safe to repeat.
   */
  private async seedBusinessProcesses() {
    const root = join(process.cwd(), 'statics', 'bpmn', 'active');
    if (!existsSync(root)) {
      this.logger.warn(`BPMN seed directory was not found: ${root}`);
      return;
    }

    const findBpmnFiles = (directory: string): string[] =>
      readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory()
          ? findBpmnFiles(path)
          : entry.name.toLowerCase().endsWith('.bpmn')
            ? [path]
            : [];
      });

    let imported = 0;
    let existing = 0;
    for (const path of findBpmnFiles(root)) {
      const file = { buffer: readFileSync(path), originalname: path };
      const parsed = this.processDefinitionService.bpmnJsonToNativeJson(
        convert.xml2js(file.buffer.toString(), {
          ignoreComment: true,
          alwaysChildren: true,
        }),
      );

      try {
        await this.processDefinitionService.findOneByKey(parsed.key, {
          version: undefined,
        });
        existing++;
      } catch {
        await this.processDefinitionService.uploadBPMNFile(file);
        imported++;
      }
    }
    this.logger.log(
      `Business-process seed complete: ${imported} imported, ${existing} already present.`,
    );
  }

  /**
   * Ensures that the deployment always has one usable super administrator.
   *
   * The operation is idempotent: an existing user is activated and assigned to
   * the super-admin group instead of creating a duplicate. Its password is not
   * overwritten during ordinary restarts. Set
   * SEED_SUPER_ADMIN_RESET_PASSWORD=true for an intentional password reset.
   */
  async seedSuperAdmin() {
    const enabled = process.env.SEED_SUPER_ADMIN_ENABLED !== 'false';
    if (!enabled) {
      this.logger.warn('Super-admin startup seed is disabled.');
      return;
    }

    const phoneNo = process.env.SEED_SUPER_ADMIN_PHONE?.trim();
    const password = process.env.SEED_SUPER_ADMIN_PASSWORD;
    const username =
      process.env.SEED_SUPER_ADMIN_USERNAME?.trim() || 'super-admin';

    if (!phoneNo || !password) {
      throw new Error(
        'Super-admin seed is enabled, but SEED_SUPER_ADMIN_PHONE or SEED_SUPER_ADMIN_PASSWORD is missing.',
      );
    }

    const requiredGroups = [];
    for (const groupDefinition of [
      { name: 'super-admin', title: 'مدیر ارشد سامانه' },
      { name: 'system-admin', title: 'مدیر سیستم' },
    ]) {
      let group = await this.userGroupsService.findOne({
        name: groupDefinition.name,
      });
      if (!group) {
        group = await this.userGroupsService.create({
          ...groupDefinition,
          type: USER_GROUP_TYPE.ROLE,
          parentId: null,
          metadata: { system: true, seeded: true },
          permissions: [],
        });
        this.logger.log(`Created ${groupDefinition.name} group.`);
      }
      requiredGroups.push(group._id);
    }
    const existingUser = await this.usersService.findOne({
      $or: [{ phoneNo }, { username }],
    });

    if (!existingUser) {
      await this.usersService.createUserByAdmin({
        name: process.env.SEED_SUPER_ADMIN_NAME?.trim() || 'مدیر',
        lastname:
          process.env.SEED_SUPER_ADMIN_LASTNAME?.trim() || 'ارشد سامانه',
        username,
        phoneNo,
        password,
        nationalCode:
          process.env.SEED_SUPER_ADMIN_NATIONAL_CODE?.trim() || undefined,
        email: process.env.SEED_SUPER_ADMIN_EMAIL?.trim() || undefined,
        groups: requiredGroups,
        type: UserTypes.SYSTEM,
        loginType: LoginTypes.PASSWORD,
        metadata: { system: true, seeded: true },
      });
      this.logger.log(`Created seeded super-admin user (${username}).`);
      return;
    }

    const groups = Array.from(
      new Set([
        ...(existingUser.groups || []).map((group) => group.toString()),
        ...requiredGroups.map((groupId) => groupId.toString()),
      ]),
    );
    const update: Record<string, any> = {
      groups,
      isActive: true,
      type: UserTypes.SYSTEM,
      loginType: LoginTypes.PASSWORD,
    };

    if (process.env.SEED_SUPER_ADMIN_RESET_PASSWORD === 'true') {
      update.password = await this.usersService.hashPassword(password);
    }

    await this.usersService.updateById(existingUser._id, update);
    this.logger.log(`Verified seeded super-admin user (${username}).`);
  }

  async runSeeder() {
    await this.seedBusinessProcesses();
    const existIndustry = await this.industryService.findOne({});
    if (!existIndustry) {
      await this.industryService.create(industries);

      await this.industryService.create(productionSubIndustries);

      await this.industryService.create(servicesSubIndustries);

      await this.industryService.create(consumerSubIndustries);
    }

    const findHiddenProject = await this.projectService.findOne({
      type: ProjectType.ACTIVITY,
    });
    if (!findHiddenProject) {
      await this.projectService.create(activityProject);
    }

    const query: GetQueryWithDownloadDto = {
      page: null,
      size: null,
      filters: '',
      dateFilters: '',
      sort: '',
      search: '',
      populate: null,
      props: '',
      projection: '',
    };

    const inspectionCosts = await this.inspectionCost.findAll(query);
    const category = await this.categoryService.findAll(query);

    for (const elem of inspectionCosts.data) {
      const [persianTitle, englishTitle] = elem.title.split(':');

      if (englishTitle === 'misc') {
        if (persianTitle === 'متفرقه') {
          await this.inspectionCost.updateOne(
            { _id: elem._id },
            {
              categoryId: new ObjectId('673f280b996962e12cf4998b'),
              title: 'متفرقه',
            },
          );
        } else {
          const newDescription = persianTitle + ' ' + (elem.description || '');
          await this.inspectionCost.updateOne(
            { _id: elem._id },
            {
              categoryId: new ObjectId('673f280b996962e12cf4998b'),
              title: 'متفرقه',
              description: newDescription,
            },
          );
        }
      } else {
        for (const c of category.data) {
          if (c.title === persianTitle) {
            await this.inspectionCost.updateOne(
              { _id: elem._id },
              { categoryId: new ObjectId(c._id), title: persianTitle },
            );
          }
        }
      }
    }
  }
}
