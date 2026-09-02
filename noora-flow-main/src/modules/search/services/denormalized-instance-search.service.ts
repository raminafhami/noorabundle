import { Injectable, OnModuleInit } from '@nestjs/common';
import { IDenormalizedInstanceSearchBody } from '../interfaces/denormalized-instance.interface';
import { BaseSearchService } from './base-search.service';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { denormalizedInstanceMapping } from '../mapping/denormalized-instance.mapping';

@Injectable()
export class DenormalizedInstanceSearchService
  extends BaseSearchService<IDenormalizedInstanceSearchBody>
  implements OnModuleInit
{
  indexName = 'denormalizedinstance';

  constructor(private readonly elasticSearchService: ElasticsearchService) {
    super(elasticSearchService);
  }
  async onModuleInit() {
    const indexExists = await this.exists(this.indexName);
    if (!indexExists) {
      await this.createIndex(this.indexName, denormalizedInstanceMapping);
    } else {
      await this.putMapping(this.indexName, denormalizedInstanceMapping);
    }
  }
}
