import { PostsHandler } from '../../handlers/posts/posts.handler';
import type { QueryExecutor } from '../../db/queries/posts.queries';
import { PostgresPostsRepository } from './postgres-posts.repository';
import { PostsService } from './posts.service';

export interface PostsComposition {
  handler: PostsHandler;
  service: PostsService;
  repository: PostgresPostsRepository;
}

export function buildPostsComposition(db: QueryExecutor): PostsComposition {
  const repository = new PostgresPostsRepository(db);
  const service = new PostsService(repository);
  const handler = new PostsHandler(service);

  return {
    handler,
    service,
    repository,
  };
}
