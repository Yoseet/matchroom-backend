import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok', enum: ['ok', 'error'] })
  status: 'ok' | 'error';

  @ApiProperty({ example: 'up', enum: ['up', 'down'] })
  database: 'up' | 'down';

  @ApiProperty({ example: 3, description: 'Latencia del chequeo en ms' })
  latencyMs: number;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  timestamp: string;
}
