import { Client } from "@notionhq/client";
import {
  CreatePageResponse,
  QueryDatabaseResponse,
  GetPageResponse,
  UpdatePageResponse,
  GetDatabaseResponse,
  OauthTokenResponse,
  CreateDatabaseResponse,
  CreateDatabaseParameters,
} from "@notionhq/client/build/src/api-endpoints";
import {
  DatabaseFilter,
  DatabaseSort,
  PageProperties,
} from "../types/notion.types";
import { redis } from "../lib/redis";

class NotionService {
  private notion: Client;
  private static readonly CACHE_KEY = "notion:types";
  private static readonly CACHE_TTL = 3600; // 1 hour in seconds

  constructor(accessToken?: string) {
    if (accessToken) {
      this.notion = new Client({
        auth: accessToken,
      });
    } else {
      this.notion = new Client();
    }
  }

  async createPage(
    databaseId: string,
    properties: PageProperties
  ): Promise<CreatePageResponse> {
    try {
      if (!properties["Name"]) {
        throw new Error("Property 'Name' is required to create a page.");
      }

      const response = await this.notion.pages.create({
        parent: {
          database_id: databaseId,
        },
        properties,
      });

      return response;
    } catch (error) {
      console.error("Error creating page in Notion:", error);
      throw error;
    }
  }

  async queryDatabase(
    databaseId: string,
    filter?: DatabaseFilter,
    sorts?: DatabaseSort[]
  ): Promise<QueryDatabaseResponse> {
    try {
      const response = await this.notion.databases.query({
        database_id: databaseId,
        ...filter,
        sorts,
      });
      return response;
    } catch (error) {
      console.error("Error querying database:", error);
      throw error;
    }
  }

  async getPage(pageId: string): Promise<GetPageResponse> {
    try {
      const response = await this.notion.pages.retrieve({
        page_id: pageId,
      });
      return response;
    } catch (error) {
      console.error("Error retrieving page:", error);
      throw error;
    }
  }

  async updatePage(
    pageId: string,
    properties: PageProperties
  ): Promise<UpdatePageResponse> {
    try {
      const response = await this.notion.pages.update({
        page_id: pageId,
        properties,
      });
      return response;
    } catch (error) {
      console.error("Error updating page:", error);
      throw error;
    }
  }

  async deletePage(pageId: string): Promise<UpdatePageResponse> {
    try {
      const response = await this.notion.pages.update({
        page_id: pageId,
        archived: true,
      });
      return response;
    } catch (error) {
      console.error("Error deleting page:", error);
      throw error;
    }
  }

  async getDatabaseInfo(databaseId: string): Promise<GetDatabaseResponse> {
    try {
      const response = await this.notion.databases.retrieve({
        database_id: databaseId,
      });
      return response;
    } catch (error) {
      console.error("Error retrieving database properties:", error);
      throw error;
    }
  }

  async getDatabasePages(databaseId: string): Promise<QueryDatabaseResponse> {
    const response = await this.notion.databases.query({
      database_id: databaseId,
    });
    return response;
  }

  async clearTypeCache(): Promise<void> {
    await redis.del(NotionService.CACHE_KEY);
  }

  async exchangeCodeForAccessToken(code: string): Promise<OauthTokenResponse> {
    const response = await this.notion.oauth.token({
      code,
      grant_type: "authorization_code",
      client_id: process.env.NOTION_CLIENT_ID as string,
      client_secret: process.env.NOTION_CLIENT_SECRET as string,
      redirect_uri: process.env.NOTION_REDIRECT_URI as string,
    });

    return response;
  }

  async searchPages(): Promise<QueryDatabaseResponse> {
    const response = await this.notion.search({
      filter: {
        property: "object",
        value: "page",
      },
      sort: { direction: "ascending", timestamp: "last_edited_time" },
    });

    return response;
  }

  public async createDatabaseInPage(
    pageId: string,
    databaseName: string,
    type: "resources" | "bookmarks" | "notes" | "salary"
  ): Promise<CreateDatabaseResponse> {
    const base: CreateDatabaseParameters = {
      parent: {
        type: "page_id",
        page_id: pageId,
      },
      title: [
        {
          type: "text",
          text: {
            content: databaseName,
          },
        },
      ],
      properties: {},
    };

    switch (type) {
      case "resources":
        base.properties = {
          Name: { title: {} },
          URL: { url: {} },
          Tags: { multi_select: { options: [] } },
          Created: { created_time: {} },
        };
        break;

      case "bookmarks":
        base.properties = {
          Title: { title: {} },
          Link: { url: {} },
          Category: { select: { options: [] } },
          Notes: { rich_text: {} },
          Added: { created_time: {} },
        };
        break;

      case "notes":
        base.properties = {
          Title: { title: {} },
          Content: { rich_text: {} },
          Tags: { multi_select: { options: [] } },
          LastEdited: { last_edited_time: {} },
        };
        break;

      case "salary":
        base.properties = {
          Description: { title: {} },
          Amount: { number: { format: "dollar" } },
          Type: {
            select: {
              options: [
                { name: "Income", color: "green" },
                { name: "Expense", color: "red" },
                { name: "Savings", color: "blue" },
              ],
            },
          },
          Category: {
            multi_select: {
              options: [
                { name: "Coffee", color: "brown" },
                { name: "Restaurants", color: "orange" },
                { name: "Clothes", color: "pink" },
                { name: "Rent", color: "gray" },
                { name: "Utilities", color: "yellow" },
                { name: "Groceries", color: "purple" },
                { name: "Transport", color: "blue" },
                { name: "Health", color: "red" },
                { name: "Freelance", color: "green" },
                { name: "Other", color: "default" },
              ],
            },
          },
          DatePaid: { date: {} },
          Notes: { rich_text: {} },
        };
        break;

      default:
        throw new Error(`Unsupported database type: ${type}`);
    }

    return await this.notion.databases.create(base);
  }
}

export default NotionService;
