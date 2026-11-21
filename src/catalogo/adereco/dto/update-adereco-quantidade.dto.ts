import { ApiProperty } from '@nestjs/swagger';

export class UpdateAderecoQuantidadeDto {
  @ApiProperty({ type: Number, format: 'int32', minimum: 0 })
  quantidade!: number;
}
