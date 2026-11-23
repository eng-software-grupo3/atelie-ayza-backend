import { ApiProperty } from '@nestjs/swagger';

export class DiaDisponivelDto {
  @ApiProperty({ example: '2026-12-01' })
  data!: string;
  @ApiProperty({ type: Boolean })
  disponivel!: boolean;
  @ApiProperty({
  type: Boolean,
  description: 'true só quando a gestora bloqueou a data, mesmo que ela esteja antes da data mínima',})
  bloqueada!: boolean;
}

export class DatasDisponiveisDto {
  @ApiProperty({ example: '2026-12' })
  mes!: string;
  @ApiProperty({ example: '2026-12-01', description: 'Primeira data que pode ser escolhida' })
  data_minima!: string;
  @ApiProperty({ type: DiaDisponivelDto, isArray: true })
  dias!: DiaDisponivelDto[];
}