import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { env } from './env.js';

/** Public path of the interactive documentation. */
export const SWAGGER_PATH = 'api/docs';

/**
 * Registers Swagger UI and the OpenAPI document.
 *
 * Documentation is intentionally disabled in production. The document is
 * also exposed as JSON at `/api/docs-json` so it can be consumed by clients
 * and contract tests.
 */
export function setupSwagger(app: INestApplication): void {
  if (env.NODE_ENV === 'production') {
    return;
  }

  const config = new DocumentBuilder()
    .setTitle('MatchRoom API')
    .setDescription(
      'API del MVP de MatchRoom: cuentas, perfiles, propiedades, ' +
        'compatibilidad, matches, chat, seguridad y notificaciones.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'access-token',
    )
    .addTag('health', 'Estado del servicio y de la base de datos')
    .addTag('auth', 'Registro, sesiones y contraseña')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    jsonDocumentUrl: `${SWAGGER_PATH}-json`,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    },
  });
}
