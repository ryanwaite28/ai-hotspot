import type { JsonObject } from './json-types';

export interface DomainEventHeaders {
  schemaVersion: number;
  producer: string;
  [key: string]: string | number | boolean;
}

export interface DomainEventEnvelope<TPayload = JsonObject> {
  eventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: number | null;
  occurredAt: string;
  payload: TPayload;
  headers: DomainEventHeaders;
}

export interface UserCreatedPayload {
  userId: string;
  handle: string;
  email: string;
  status: string;
  role: string;
}

export interface UserEmailResetRequestedPayload {
  userId: string;
  email: string;
}

export interface StoryReplyCreatedPayload {
  storyId: string;
  storyOwnerUserId: string;
  storyOwnerEmail: string;
  replyAuthorUserId: string;
  replyBodyText: string;
}

export type UserCreatedEvent = DomainEventEnvelope<UserCreatedPayload> & {
  eventType: 'user.created';
  aggregateType: 'user';
};

export type UserEmailResetRequestedEvent = DomainEventEnvelope<UserEmailResetRequestedPayload> & {
  eventType: 'user.email-reset-requested';
  aggregateType: 'user';
};

export type StoryReplyCreatedEvent = DomainEventEnvelope<StoryReplyCreatedPayload> & {
  eventType: 'story.reply.created';
  aggregateType: 'story';
};
