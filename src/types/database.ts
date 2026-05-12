export interface Profile {
  id: string
  username: string
  role: 'editor' | 'admin'
  active: boolean
  created_at: string
}

export interface Category {
  id: string
  name: string
  created_by: string | null
  created_at: string
}

export interface Bookmark {
  id: string
  title: string
  description: string
  url: string
  categories: string[]
  user_id: string
  highlighted: boolean
  created_at: string
  updated_at: string
  profiles?: { username: string } | null
}

export interface BookmarkInsert {
  title: string
  description: string
  url: string
  categories: string[]
  user_id: string
  highlighted?: boolean
}

export interface BookmarkUpdate {
  title?: string
  description?: string
  url?: string
  categories?: string[]
  highlighted?: boolean
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
      }
      categories: {
        Row: Category
        Insert: Omit<Category, 'id' | 'created_at'>
        Update: Partial<Omit<Category, 'id' | 'created_at'>>
      }
      bookmarks: {
        Row: Bookmark
        Insert: BookmarkInsert
        Update: BookmarkUpdate
      }
    }
  }
}
