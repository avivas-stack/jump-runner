import { config, hasSearchCredentials } from "../config";
import { SearchProvider } from "./types";
import { TavilySearchProvider } from "./tavily";

export function getSearchProvider(): SearchProvider | null {
  if (!hasSearchCredentials()) return null;
  return new TavilySearchProvider(config.tavilyApiKey!);
}

export * from "./types";
