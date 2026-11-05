import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class SessionValidatorService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * A JWT is only the first check: the session must still exist, be
   * unrevoked, be unexpired and belong to an active account.
   */
  async isSessionActive(userId: string, sessionId: string): Promise<boolean> {
    const rows: Array<{ exists: number }> = await this.dataSource.query(
      `
        SELECT 1 AS exists
        FROM user_sessions AS session
        INNER JOIN users AS account ON account.id = session.user_id
        WHERE session.id = $1
          AND session.user_id = $2
          AND session.revoked_at IS NULL
          AND session.expires_at > now()
          AND account.status = 'active'
        LIMIT 1
      `,
      [sessionId, userId],
    );

    return rows.length > 0;
  }
}
