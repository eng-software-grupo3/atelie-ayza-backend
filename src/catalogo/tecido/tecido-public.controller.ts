import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { TecidoPublicDto } from './dto/tecido-public.dto.js';
import { TecidoService } from './tecido.service.js';

@ApiTags('tecidos')
@Controller('api/tecidos')
export class TecidosPublicController {
  constructor(private readonly service: TecidoService) {}

  @Get()
  @ApiOkResponse({ type: TecidoPublicDto, isArray: true })
  list() {
    return this.service.list(false);
  }
}
