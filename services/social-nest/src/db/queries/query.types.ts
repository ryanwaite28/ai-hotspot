export type JsonPrimitive = string | number | boolean | null;

export interface JsonObject {
  [key: string]: JsonValue;
}

export type JsonArray = JsonValue[];

export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

export type SqlValue = string | number | boolean | null | JsonValue;

export interface DbRow {
  [key: string]: SqlValue;
}

export type QueryParam = SqlValue;
