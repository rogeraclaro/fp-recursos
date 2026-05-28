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
  admin_reviewed: boolean
  created_at: string
  updated_at: string
  profiles?: { username: string; active: boolean } | null
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
  admin_reviewed?: boolean
}

export interface Message {
  id: string
  sender_id: string
  recipient_id: string
  content: string
  read_by_recipient: boolean
  created_at: string
}

export interface EditorRequest {
  id: string
  name: string
  email: string
  comment: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  reviewed_at: string | null
  reviewed_by: string | null
}

export interface ContactRequest {
  id: string
  name: string
  email: string
  message: string
  created_at: string
  read: boolean
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
