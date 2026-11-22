import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type {
  CreatePostInput,
  CreateQuoteInput,
  CreateReplyInput,
  CreateRepostInput,
  DeletePostInput,
  PinPostInput,
  PostFeedInput,
  PostInteractionInput,
  TopicFeedInput,
  UpdatePostInput,
} from '../../../../../packages/contracts/src';
import { PostsService } from '../../service/posts/posts.service';

@Controller('/internal/v1/posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post('/drafts')
  async createDraft(@Body() body: Omit<CreatePostInput, 'publishAtIso'>): Promise<unknown> {
    return this.postsService.createDraft(body);
  }

  @Post()
  async createPost(@Body() body: CreatePostInput): Promise<unknown> {
    return this.postsService.createOrSchedulePost(body);
  }

  @Post('/replies')
  async createReply(@Body() body: CreateReplyInput): Promise<unknown> {
    const reply = await this.postsService.createReply(body);
    if (!reply) {
      throw new NotFoundException('Reply target is unavailable');
    }
    return reply;
  }

  @Post('/reposts')
  async createRepost(@Body() body: CreateRepostInput): Promise<unknown> {
    const repost = await this.postsService.createRepost(body);
    if (!repost) {
      throw new NotFoundException('Repost target is unavailable');
    }
    return repost;
  }

  @Post('/quotes')
  async createQuote(@Body() body: CreateQuoteInput): Promise<unknown> {
    const quote = await this.postsService.createQuote(body);
    if (!quote) {
      throw new NotFoundException('Quote target is unavailable');
    }
    return quote;
  }

  @Patch('/:postId')
  async updatePost(
    @Param('postId') postId: string,
    @Body() body: Omit<UpdatePostInput, 'postId'>,
  ): Promise<unknown> {
    const post = await this.postsService.updatePost({
      ...body,
      postId,
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    return post;
  }

  @Delete('/:postId')
  async deletePost(
    @Param('postId') postId: string,
    @Body() body: Omit<DeletePostInput, 'postId'>,
  ): Promise<unknown> {
    return this.postsService.deletePost({
      ...body,
      postId,
    });
  }

  @Post('/:postId/pin')
  async pinPost(
    @Param('postId') postId: string,
    @Body() body: Omit<PinPostInput, 'postId'>,
  ): Promise<unknown> {
    const post = await this.postsService.pinPost({
      ...body,
      postId,
    });
    if (!post) {
      throw new NotFoundException('Published post not found');
    }
    return post;
  }

  @Post('/:postId/like')
  async likePost(
    @Param('postId') postId: string,
    @Body() body: Omit<PostInteractionInput, 'postId'>,
  ): Promise<unknown> {
    return this.postsService.likePost({
      ...body,
      postId,
    });
  }

  @Post('/:postId/unlike')
  async unlikePost(
    @Param('postId') postId: string,
    @Body() body: Omit<PostInteractionInput, 'postId'>,
  ): Promise<unknown> {
    return this.postsService.unlikePost({
      ...body,
      postId,
    });
  }

  @Post('/:postId/bookmark')
  async bookmarkPost(
    @Param('postId') postId: string,
    @Body() body: Omit<PostInteractionInput, 'postId'>,
  ): Promise<unknown> {
    return this.postsService.bookmarkPost({
      ...body,
      postId,
    });
  }

  @Post('/:postId/unbookmark')
  async unbookmarkPost(
    @Param('postId') postId: string,
    @Body() body: Omit<PostInteractionInput, 'postId'>,
  ): Promise<unknown> {
    return this.postsService.unbookmarkPost({
      ...body,
      postId,
    });
  }

  @Get('/by-id/:postId')
  async getOwnPost(
    @Param('postId') postId: string,
    @Query('authorUserId') authorUserId: string,
  ): Promise<unknown> {
    if (!authorUserId) {
      throw new BadRequestException('authorUserId is required');
    }

    const post = await this.postsService.getOwnPost({
      postId,
      authorUserId,
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return post;
  }

  @Get('/feed/following')
  async listFollowingFeed(
    @Query('viewerUserId') viewerUserId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<unknown> {
    if (!viewerUserId) {
      throw new BadRequestException('viewerUserId is required');
    }

    const parsedLimit = limit ? Number(limit) : undefined;
    const input: PostFeedInput = {
      viewerUserId,
      cursor,
      limit: parsedLimit,
    };

    return this.postsService.listFollowingFeed(input);
  }

  @Get('/feed/public')
  async listPublicFeed(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<unknown> {
    const parsedLimit = limit ? Number(limit) : undefined;
    return this.postsService.listPublicFeed({
      cursor,
      limit: parsedLimit,
    });
  }

  @Get('/feed/topic/:topic')
  async listTopicFeed(
    @Param('topic') topic: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<unknown> {
    const parsedLimit = limit ? Number(limit) : undefined;
    const input: TopicFeedInput = {
      topic,
      cursor,
      limit: parsedLimit,
    };
    return this.postsService.listTopicFeed(input);
  }
}
