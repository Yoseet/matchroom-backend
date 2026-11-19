import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../../../config/env.js';

/**
 * Email delivery for the accounts module.
 *
 * When SMTP is configured it uses nodemailer. Without SMTP it logs the message
 * (including the one-time link) in development/test so the flows can be
 * exercised locally, and fails with 503 in production instead of pretending
 * the email was sent.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null = this.createTransporter();

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const link = `${env.APP_PUBLIC_URL}/verificar-correo?token=${encodeURIComponent(token)}`;
    await this.send({
      to,
      subject: 'Verifica tu correo en Match Room',
      text: [
        'Bienvenido a Match Room.',
        '',
        'Confirma tu correo abriendo este enlace (vence en 24 horas):',
        link,
        '',
        'Si no creaste una cuenta, puedes ignorar este mensaje.',
      ].join('\n'),
    });
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const link = `${env.APP_PUBLIC_URL}/restablecer-contrasena?token=${encodeURIComponent(token)}`;
    await this.send({
      to,
      subject: 'Restablece tu contraseña de Match Room',
      text: [
        'Recibimos una solicitud para restablecer tu contraseña.',
        '',
        'Abre este enlace para crear una nueva (vence en 1 hora):',
        link,
        '',
        'Si no solicitaste el cambio, ignora este mensaje.',
      ].join('\n'),
    });
  }

  private async send(message: {
    to: string;
    subject: string;
    text: string;
  }): Promise<void> {
    if (!this.transporter) {
      if (env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException(
          'Email delivery is not configured (set SMTP_HOST, MAIL_FROM and credentials)',
        );
      }
      this.logger.log(
        `Correo no enviado (SMTP sin configurar). Para: ${message.to} | ${message.subject}\n${message.text}`,
      );
      return;
    }

    await this.transporter.sendMail({
      from: env.MAIL_FROM ?? undefined,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
  }

  private createTransporter(): Transporter | null {
    if (!env.SMTP_HOST || !env.MAIL_FROM) return null;
    return nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ?? 587,
      secure: env.SMTP_SECURE,
      auth:
        env.SMTP_USER && env.SMTP_PASSWORD
          ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
          : undefined,
    });
  }
}
