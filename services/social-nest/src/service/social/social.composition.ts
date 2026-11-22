import type { QueryExecutor } from '../../db/queries/social.queries';
import { PostgresSocialRepository } from './postgres-social.repository';
import { SocialService } from './social.service';

export interface SocialComposition {
  service: SocialService;
  repository: PostgresSocialRepository;
}

export function buildSocialComposition(db: QueryExecutor): SocialComposition {
  const repository = new PostgresSocialRepository(db);
  const service = new SocialService(repository);

  return { service, repository };
}
