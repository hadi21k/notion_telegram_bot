import { CreatePageParameters } from "@notionhq/client/build/src/api-endpoints";

export type PageProperties = CreatePageParameters["properties"];

export interface CreatePageRequest {
  properties: PageProperties;
}

export interface UpdatePageRequest {
  properties: PageProperties;
}

export interface DatabaseFilter {
  property: string;
  select?: {
    equals?: string;
  };
  checkbox?: {
    equals?: boolean;
  };
  date?: {
    equals?: string;
  };
  number?: {
    equals?: number;
  };
  text?: {
    contains?: string;
  };
}

export type SelectOption = {
  id: string;
  name: string;
  color: string;
};

export type SelectProperty = {
  id: string;
  name: string;
  type: "select";
  select: {
    options: SelectOption[];
  };
};

export type NotionPropertySchema = {
  type: string;
  name: string;
  config?: Record<string, unknown>; // e.g., select options, number format, etc.
};

export type PropertyResult = Record<string, NotionPropertySchema>;

export type NotionProp = {
  type: string;
  name: string;
  config: Record<string, unknown>;
};

export type RawValues = Record<string, string | string[]>;

export type NotionSessionFlow = {
  url?: string;
  title?: string;
  type?: string;
  pageId?: string;
  databaseName?: string;
  databaseId?: string;
  props?: PropertyResult;
  remainingProps?: PropertyResult;
  values?: RawValues;
  currentProperty?: string;
};

export interface DatabaseSort {
  property: string;
  direction: "ascending" | "descending";
}
