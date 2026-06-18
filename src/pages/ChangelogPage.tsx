import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Plus, Loader2 } from 'lucide-react'
import { ChangelogPostCard } from '../components/ChangelogPostCard'
import { ChangelogEditor } from '../components/ChangelogEditor'
import { getChangelogPosts, createChangelogPost, updateChangelogPost, deleteChangelogPost } from '../services/changelog'
import { useAuth } from '../context/AuthContext'
import { theme } from '../theme'
import type { ChangelogPost } from '../types/database'

interface Props {
  onBack: () => void
  onNavigateToBookmark: (bookmarkId: string) => void
}

export function ChangelogPage({ onBack, onNavigateToBookmark }: Props) {
  const { isAdmin, user } = useAuth()
  const [posts, setPosts] = useState<ChangelogPost[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [editingPost, setEditingPost] = useState<ChangelogPost | null>(null)

  const loadPage = useCallback(async (pageNum: number, append: boolean) => {
    try {
      const { posts: newPosts, hasMore: more } = await getChangelogPosts(pageNum, isAdmin)
      setPosts((prev) => append ? [...prev, ...newPosts] : newPosts)
      setHasMore(more)
      setPage(pageNum)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [isAdmin])

  useEffect(() => {
    setLoading(true)
    loadPage(0, false)
  }, [loadPage])

  function handleLoadMore() {
    setLoadingMore(true)
    loadPage(page + 1, true)
  }

  async function handleSave(data: { title: string; content: string; status: 'draft' | 'published'; author_id: string }) {
    if (editingPost) {
      const updated = await updateChangelogPost(editingPost.id, data)
      setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
    } else {
      const created = await createChangelogPost(data)
      setPosts((prev) => [created, ...prev])
    }
    setShowEditor(false)
    setEditingPost(null)
  }

  function handleEdit(post: ChangelogPost) {
    setEditingPost(post)
    setShowEditor(true)
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminar aquest post?')) return
    await deleteChangelogPost(id)
    setPosts((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <div className={theme.page}>
      {/* Capçalera */}
      <header className='bg-surface border-b-4 border-black p-6 shadow-md'>
        <div className='max-w-[1600px] mx-auto flex items-center justify-between gap-4'>
          <div className='flex items-center gap-4'>
            <button
              onClick={onBack}
              className='flex items-center gap-2 font-skin font-bold text-sm px-4 py-2.5 border-skin bg-surface shadow-skin-sm hover:bg-accent transition-colors'
            >
              <ArrowLeft size={16} /> Tornar
            </button>
            <h1 className='text-4xl font-black uppercase tracking-tighter bg-black text-white px-3 py-1 inline-block transform -rotate-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]'>
              Changelog
            </h1>
          </div>
          {isAdmin && (
            <button
              onClick={() => { setEditingPost(null); setShowEditor(true) }}
              className='flex items-center gap-1.5 font-skin font-bold text-sm px-4 py-2.5 border-skin bg-accent shadow-skin-sm hover:bg-accent-hover transition-colors'
            >
              <Plus size={16} /> Nou post
            </button>
          )}
        </div>
      </header>

      {/* Llista de posts */}
      <main className='max-w-[1600px] mx-auto p-6 flex flex-col gap-8 mt-4'>
        {loading && (
          <div className='flex justify-center py-20'>
            <div className={theme.loadingSpinner} />
          </div>
        )}

        {!loading && posts.length === 0 && (
          <div className='text-center py-32 border-4 border-dashed border-gray-300 bg-gray-50'>
            <p className='font-skin text-3xl font-bold text-gray-400 mb-4'>Sense posts</p>
            {isAdmin && (
              <p className='font-skin text-gray-500'>Crea el primer post amb el botó "Nou post".</p>
            )}
          </div>
        )}

        {!loading && posts.map((post) => (
          <ChangelogPostCard
            key={post.id}
            post={post}
            canEdit={isAdmin}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onBookmarkClick={onNavigateToBookmark}
          />
        ))}

        {hasMore && !loading && (
          <div className='flex justify-center'>
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className='flex items-center gap-2 font-skin font-bold text-sm px-6 py-3 border-skin bg-surface shadow-skin-sm hover:bg-accent transition-colors disabled:opacity-50'
            >
              {loadingMore ? <Loader2 size={16} className='animate-spin' /> : null}
              {loadingMore ? 'Carregant...' : 'Carregar més'}
            </button>
          </div>
        )}
      </main>

      {/* Editor modal */}
      {showEditor && user && (
        <ChangelogEditor
          post={editingPost ?? undefined}
          authorId={user.id}
          onSave={handleSave}
          onCancel={() => { setShowEditor(false); setEditingPost(null) }}
        />
      )}
    </div>
  )
}
