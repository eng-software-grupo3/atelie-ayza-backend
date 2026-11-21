import { ApiProperty } from '@nestjs/swagger';

export class SetModeloHabilitadoDto {
  @ApiProperty({
    description: 'Define se o modelo estará disponível na listagem pública',
    example: false,
    type: Boolean,
  })
  habilitado!: boolean;
}
