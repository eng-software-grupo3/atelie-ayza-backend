import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module.js';
import { Adereco } from '../entities/adereco.entity.js';
import { AderecoController, AderecosPublicController } from './adereco.controller.js';
import { AderecoService } from './adereco.service.js';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([Adereco])],
  controllers: [AderecoController, AderecosPublicController],
  providers: [AderecoService],
})
export class AderecoModule {}
