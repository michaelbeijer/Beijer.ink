export interface Notebook {
  id: string;
  name: string;
  icon: string | null;
  sortOrder: number;
  parentId: string | null;
  isFavorite: boolean;
  publishTarget?: boolean;
  publishBeijerterm?: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { notes: number };
}
