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
}

export type Category = string
