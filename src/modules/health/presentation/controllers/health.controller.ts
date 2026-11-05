import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { HealthResponseDto } from '../../application/dto/health-response.dto.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Comprueba el estado del servicio y de PostgreSQL',
  })
  @ApiOkResponse({
    description: 'El servicio y la base de datos responden.',
    type: HealthResponseDto,
  })
  @ApiServiceUnavailableResponse({
    description: 'La base de datos no responde.',
    schema: {
      example: {
        status: 'error',
        database: 'down',
      },
    },
  })
  async check(): Promise<HealthResponseDto> {
    const startedAt = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'down',
      });
    }

    return {
      status: 'ok',
      database: 'up',
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    };
  }
}
