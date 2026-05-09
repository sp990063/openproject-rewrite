export interface WikiPage {
  id: string;
  projectId: string;
  title: string;
  slug: string;
  content: string;
  parentId: string | null;
  authorId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface WikiPageVersion {
  id: string;
  wikiPageId: string;
  content: string;
  authorId: string;
  version: number;
  createdAt: string;
}

export interface WikiPageWithMeta extends WikiPage {
  author: Pick<User, 'id' | 'name'>;
  parent: WikiPage | null;
  children: Pick<WikiPage, 'id' | 'title' | 'slug'>[];
  versionCount: number;
}

export interface User {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
}
