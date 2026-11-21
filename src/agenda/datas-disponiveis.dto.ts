import { ApiProperty } from '@nestjs/swagger';

export class DiaDisponivelDto {
  @ApiProperty({ example: '2026-12-01' })
  data!: string;
  @ApiProperty({ type: Boolean })
  disponivel!: boolean;
}

export class DatasDisponiveisDto {
  @ApiProperty({ example: '2026-12' })
  mes!: string;
  @ApiProperty({ example: '2026-12-01', description: 'Primeira data que pode ser escolhida' })
  data_minima!: string;
  @ApiProperty({ type: DiaDisponivelDto, isArray: true })
  dias!: DiaDisponivelDto[];
}