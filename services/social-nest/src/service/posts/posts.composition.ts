import type { QueryExecutor } from '../../db/queries/posts.queries';
import { PostgresPostsRepository } from './postgres-posts.repository';
import { PostsService } from './posts.service';

export interface PostsComposition {
  service: PostsService;
  repository: PostgresPostsRepository;
}

export function buildPostsComposition(db: QueryExecutor): PostsComposition {
  const repository = new PostgresPostsRepository(db);
  const service = new PostsService(repository);
  return { service, repository };
}
