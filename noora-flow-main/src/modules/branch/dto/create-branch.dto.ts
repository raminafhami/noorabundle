import { IsMongoId, IsOptional, IsString } from 'class-validator';

export class CreateBranchDto {
  @IsString()
  name: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsMongoId()
  managerId?: string;
}
