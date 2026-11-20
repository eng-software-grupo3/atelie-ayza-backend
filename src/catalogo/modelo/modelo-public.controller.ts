import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ModeloPublicDto } from './dto/modelo-public.dto.js';
import { ModeloService } from './modelo.service.js';

@ApiTags('modelos')
@Controller('api/modelos')
export class ModelosPublicController {
  constructor(private readonly service: ModeloService) {}

  @Get()
  @ApiOkResponse({ type: ModeloPublicDto, isArray: true })
  list() {
    return this.service.list(false);
  }
}
