import { SocialHandler } from '../../handlers/social/social.handler';
import type { QueryExecutor } from '../../db/queries/social.queries';
import { PostgresSocialRepository } from './postgres-social.repository';
import { SocialService } from './social.service';

export interface SocialComposition {
  handler: SocialHandler;
  service: SocialService;
  repository: PostgresSocialRepository;
}

export function buildSocialComposition(db: QueryExecutor): SocialComposition {
  const repository = new PostgresSocialRepository(db);
  const service = new SocialService(repository);
  const handler = new SocialHandler(service);

  return {
    handler,
    service,
    repository,
  };
}
