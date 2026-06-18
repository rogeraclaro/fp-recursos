import React, { useState, useMemo, useEffect } from 'react'
import {
	Search,
	Menu,
	X,
	Settings,
	Plus,
	LogOut,
	Download,
	Trash2,
	Edit2,
	Check,
	User,
	MessageSquare,
	Mail,
} from 'lucide-react'
import { BookmarkCard } from './components/BookmarkCard'
import { BookmarkForm } from './components/BookmarkForm'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ScrollToTop } from './components/ScrollToTop'
import { SkinPicker } from './components/SkinPicker'
import { useAuth } from './context/AuthContext'
import {
	getBookmarks,
	createBookmark,
	deleteBookmark,
	toggleHighlight,
	updateBookmark,
	reassignCategory,
} from './services/bookmarks'
import { getCategories, createCategory, updateCategory, deleteCategory } from './services/categories'
import { getEditorHighlights, toggleEditorHighlight } from './services/highlights'
import { updateProfile } from './services/profiles'
import { getUnreadCount } from './services/messages'
import { getUnreadContactCount } from './services/contacts'
import { getPendingEditorRequestCount } from './services/editorRequests'
import { getNewPostsCount } from './services/changelog'
import { SetPasswordModal } from './components/SetPasswordModal'
import { MessagesModal } from './components/MessagesModal'
import { ContactModal } from './components/ContactModal'
import { ContactsAdminModal } from './components/ContactsAdminModal'
import { EditorRequestModal } from './components/EditorRequestModal'
import { EditorRequestsAdminModal } from './components/EditorRequestsAdminModal'
import { LoginPage } from './pages/LoginPage'
import { Button, Input, Label } from './components/UI'
import { supabase } from './lib/supabase'
import type { Bookmark, BookmarkInsert, Category } from './types/database'
import { theme } from './theme'

type View = 'public' | 'editor' | 'admin' | 'changelog'

// Immune a StrictMode (doble-effect) i a Vite HMR (re-avaluació de mòdul).
// performance.timeOrigin és únic per càrrega real de pàgina (F5), no canvia amb HMR.
const _pageKey = `fp-lv-${Math.round(performance.timeOrigin)}`
if (!sessionStorage.getItem(_pageKey)) {
	Object.keys(sessionStorage).filter((k) => k.startsWith('fp-lv-')).forEach((k) => sessionStorage.removeItem(k))
	sessionStorage.setItem(_pageKey, JSON.stringify(localStorage.getItem('fp-lastVisit')))
	localStorage.setItem('fp-lastVisit', new Date().toISOString())
}
const LAST_VISIT: string | null = JSON.parse(sessionStorage.getItem(_pageKey)!)

const EditorView = React.lazy(() => import('./pages/EditorView').then((m) => ({ default: m.EditorView })))
const AdminView = React.lazy(() => import('./pages/AdminView').then((m) => ({ default: m.AdminView })))
const ChangelogPage = React.lazy(() => import('./pages/ChangelogPage').then((m) => ({ default: m.ChangelogPage })))

export default function App() {
	const { isAdmin, isEditor, user, profile, signOut, refreshProfile } = useAuth()
	const [view, setView] = useState<View>('public')
	const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
	const [categories, setCategories] = useState<Category[]>([])
	const [loading, setLoading] = useState(true)
	const [searchQuery, setSearchQuery] = useState('')
	const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
	const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null)
	const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
	const [newCategoryName, setNewCategoryName] = useState('')
	const [editingCat, setEditingCat] = useState<{ id: string; name: string } | null>(null)
	const [showNewResourceForm, setShowNewResourceForm] = useState(false)
	const [exporting, setExporting] = useState(false)
	const [deletingCat, setDeletingCat] = useState<{ id: string; name: string } | null>(null)
	const [editorHighlights, setEditorHighlights] = useState<string[]>([])
	const [showEditorCatModal, setShowEditorCatModal] = useState(false)
	const [editorNewCatName, setEditorNewCatName] = useState('')
	const [showLoginModal, setShowLoginModal] = useState(false)
	const [isMobileUserMenuOpen, setIsMobileUserMenuOpen] = useState(false)
	const [showMessagesModal, setShowMessagesModal] = useState(false)
	const [unreadMessages, setUnreadMessages] = useState(0)
	const [showContactModal, setShowContactModal] = useState(false)
	const [showContactsAdminModal, setShowContactsAdminModal] = useState(false)
	const [unreadContacts, setUnreadContacts] = useState(0)
	const [showEditorRequestModal, setShowEditorRequestModal] = useState(false)
	const [showEditorRequestsAdminModal, setShowEditorRequestsAdminModal] = useState(false)
	const [pendingEditorRequests, setPendingEditorRequests] = useState(0)
	const [changelogBadge, setChangelogBadge] = useState(0)
	const [showProfileModal, setShowProfileModal] = useState(false)
	const [profileUsername, setProfileUsername] = useState('')
	const [profilePassword, setProfilePassword] = useState('')
	const [profileConfirmPassword, setProfileConfirmPassword] = useState('')
	const [profileError, setProfileError] = useState('')
	const [profileSaving, setProfileSaving] = useState(false)
	const [editorCatError, setEditorCatError] = useState('')
	const [editorEditingCat, setEditorEditingCat] = useState<{ id: string; name: string } | null>(null)
	const [showSetPasswordModal, setShowSetPasswordModal] = useState(() => {
		const hash = new URLSearchParams(window.location.hash.slice(1))
		const type = hash.get('type')
		return type === 'invite' || type === 'recovery'
	})

	useEffect(() => {
		if (!user) {
			setView('public')
			setEditorHighlights([])
			setUnreadMessages(0)
			return
		}
		setShowLoginModal(false)
		setView('public')
		if (isEditor && !isAdmin) {
			getEditorHighlights(user.id).then(setEditorHighlights)
		}
		getUnreadCount(user.id).then(setUnreadMessages)
		if (isAdmin) {
			getUnreadContactCount().then(setUnreadContacts)
			getPendingEditorRequestCount().then(setPendingEditorRequests)
		}
	}, [user, isAdmin, isEditor])

	useEffect(() => {
		const lastSeen = localStorage.getItem('fp-changelog-last-seen') ?? new Date(0).toISOString()
		getNewPostsCount(lastSeen).then(setChangelogBadge)
	}, [])

	useEffect(() => {
		Promise.all([getBookmarks(), getCategories()])
			.then(([bks, cats]) => {
				setBookmarks(bks)
				setCategories(cats)
			})
			.finally(() => setLoading(false))
	}, [])

	const groupedBookmarks = useMemo(() => {
		const knownNames = new Set(categories.map((c) => c.name))
		const groups: Record<string, Bookmark[]> = {}
		categories.forEach((c) => {
			groups[c.name] = []
		})
		bookmarks.forEach((b) => {
			const hasOrphan = b.categories.some((cat) => cat !== 'Altres' && !knownNames.has(cat))
			if (hasOrphan) {
				if (!groups['Altres']) groups['Altres'] = []
				groups['Altres'].push(b)
			} else {
				b.categories.forEach((cat) => {
					if (groups[cat]) {
						groups[cat].push(b)
					} else {
						if (!groups['Altres']) groups['Altres'] = []
						groups['Altres'].push(b)
					}
				})
			}
		})
		Object.keys(groups).forEach((key) => {
			groups[key].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
		})
		return groups
	}, [bookmarks, categories])

	const editorHighlightSet = useMemo(() => new Set(editorHighlights), [editorHighlights])

	const highlightedBookmarks = useMemo(() => {
		return bookmarks
			.filter((b) => b.highlighted)
			.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
	}, [bookmarks])

	const displayHighlighted = useMemo(() => {
		if (isEditor && !isAdmin)
			return bookmarks
				.filter((b) => editorHighlightSet.has(b.id))
				.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
		return highlightedBookmarks
	}, [isEditor, isAdmin, bookmarks, editorHighlightSet, highlightedBookmarks])

	const orphanCategories = useMemo(() => {
		const known = new Set(categories.map((c) => c.name))
		const orphans = new Set<string>()
		bookmarks.forEach((b) =>
			b.categories.forEach((cat) => {
				if (!known.has(cat)) orphans.add(cat)
			}),
		)
		return [...orphans].sort()
	}, [bookmarks, categories])

	const orphanBookmarkIds = useMemo(() => {
		const knownNames = new Set(categories.map((c) => c.name))
		const ids = new Set<string>()
		bookmarks.forEach((b) => {
			if (b.categories.some((cat) => cat !== 'Altres' && !knownNames.has(cat))) ids.add(b.id)
		})
		return ids
	}, [bookmarks, categories])

	const newBookmarkIds = useMemo(() => {
		if (!LAST_VISIT) return new Set<string>()
		const lastVisitTime = new Date(LAST_VISIT).getTime()
		const maxAge = 100 * 24 * 60 * 60 * 1000
		const now = Date.now()
		const ids = new Set(
			bookmarks
				.filter((b) => {
					const created = new Date(b.created_at).getTime()
					const isNew = created > lastVisitTime && now - created < maxAge
					return isNew
				})
				.map((b) => b.id),
		)
		return ids
	}, [bookmarks])

	const searchResults = useMemo(() => {
		if (!searchQuery.trim()) return []
		const lq = searchQuery.toLowerCase()
		return bookmarks.filter(
			(b) =>
				b.title.toLowerCase().includes(lq) ||
				b.description?.toLowerCase().includes(lq) ||
				b.url.toLowerCase().includes(lq),
		)
	}, [bookmarks, searchQuery])

	function handleChangelogOpen() {
		setView('changelog')
		setChangelogBadge(0)
		localStorage.setItem('fp-changelog-last-seen', new Date().toISOString())
	}

	function handleNavigateToBookmark(bookmarkId: string) {
		setView('public')
		setTimeout(() => {
			document.getElementById(`bookmark-${bookmarkId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
		}, 150)
	}

	function scrollToCategory(cat: string) {
		const el = document.getElementById(`category-${cat}`)
		if (el) {
			const offset = 80
			const bodyRect = document.body.getBoundingClientRect().top
			const top = el.getBoundingClientRect().top - bodyRect - offset
			window.scrollTo({ top, behavior: 'smooth' })
			setIsMobileMenuOpen(false)
		}
	}

	function handleSearch(query: string) {
		setSearchQuery(query)
		setIsSearchModalOpen(false)
	}

	async function handleDelete(id: string) {
		if (!confirm('Eliminar aquest recurs?')) return
		await deleteBookmark(id)
		setBookmarks((prev) => prev.filter((b) => b.id !== id))
	}

	async function handleToggleHighlight(id: string, highlighted: boolean) {
		await toggleHighlight(id, highlighted)
		setBookmarks((prev) => prev.map((b) => (b.id === id ? { ...b, highlighted } : b)))
	}

	async function handleToggleEditorHighlight(id: string, on: boolean) {
		await toggleEditorHighlight(user!.id, id, on)
		setEditorHighlights((prev) => (on ? [...prev, id] : prev.filter((x) => x !== id)))
	}

	async function handleEditorAddCat() {
		if (!editorNewCatName.trim() || !user) return
		setEditorCatError('')
		try {
			const cat = await createCategory(editorNewCatName.trim(), user.id)
			setCategories((prev) => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)))
			setEditorNewCatName('')
		} catch (err) {
			setEditorCatError((err as { message?: string })?.message ?? 'Error desconegut')
		}
	}

	async function handleEditorEditCat(id: string, name: string) {
		try {
			const updated = await updateCategory(id, name)
			setCategories((prev) =>
				prev.map((c) => (c.id === id ? updated : c)).sort((a, b) => a.name.localeCompare(b.name)),
			)
			setEditorEditingCat(null)
		} catch (err) {
			setEditorCatError((err as { message?: string })?.message ?? 'Error en editar')
		}
	}

	async function handleEditorDeleteCat(id: string, name: string) {
		if (!confirm(`Eliminar la categoria "${name}"?`)) return
		try {
			await deleteCategory(id)
			setCategories((prev) => prev.filter((c) => c.id !== id))
		} catch (err) {
			setEditorCatError((err as { message?: string })?.message ?? 'Error en eliminar')
		}
	}

	function isPersonalHighlight(bookmarkId: string) {
		return isEditor && !isAdmin ? editorHighlightSet.has(bookmarkId) : false
	}

	async function handleEditBookmark(b: Bookmark) {
		if (isAdmin && !b.admin_reviewed && b.user_id !== user?.id) {
			await updateBookmark(b.id, { admin_reviewed: true })
			setBookmarks((prev) => prev.map((bk) => (bk.id === b.id ? { ...bk, admin_reviewed: true } : bk)))
		}
		setEditingBookmark(b)
	}

	async function handleEditSave(data: BookmarkInsert) {
		if (!editingBookmark) return
		const duplicate = bookmarks.find((b) => b.url === data.url && b.id !== editingBookmark.id)
		if (duplicate) throw new Error(`Ja existeix un recurs amb aquesta URL: "${duplicate.title}"`)
		const { user_id: _, ...updates } = data
		const updated = await updateBookmark(editingBookmark.id, updates)
		setBookmarks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
		setEditingBookmark(null)
	}

	async function handleExport() {
		setExporting(true)
		try {
			const bks = await getBookmarks()
			const blob = new Blob([JSON.stringify(bks, null, 2)], { type: 'application/json' })
			const url = URL.createObjectURL(blob)
			const a = document.createElement('a')
			a.href = url
			a.download = `fp-recursos-backup-${new Date().toISOString().split('T')[0]}.json`
			document.body.appendChild(a)
			a.click()
			document.body.removeChild(a)
			URL.revokeObjectURL(url)
		} finally {
			setExporting(false)
		}
	}

	async function handleCreateBookmark(data: BookmarkInsert) {
		const duplicate = bookmarks.find((b) => b.url === data.url)
		if (duplicate) throw new Error(`Ja existeix un recurs amb aquesta URL: "${duplicate.title}"`)
		const created = await createBookmark(data)
		setBookmarks((prev) => [created, ...prev])
		setShowNewResourceForm(false)
	}

	async function handleAddCategory() {
		if (!newCategoryName.trim() || !user) return
		const cat = await createCategory(newCategoryName.trim(), user.id)
		setCategories((prev) => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)))
		setNewCategoryName('')
	}

	async function handleUpdateCategory(id: string, name: string) {
		const oldName = categories.find((c) => c.id === id)?.name
		const updated = await updateCategory(id, name)
		if (oldName && oldName !== name) {
			await reassignCategory(oldName, name)
			setBookmarks((prev) =>
				prev.map((b) => ({
					...b,
					categories: b.categories.map((c) => (c === oldName ? name : c)),
				})),
			)
		}
		setCategories((prev) =>
			prev.map((c) => (c.id === id ? updated : c)).sort((a, b) => a.name.localeCompare(b.name)),
		)
		setEditingCat(null)
	}

	function handleDeleteCategory(id: string) {
		const cat = categories.find((c) => c.id === id)
		if (!cat) return
		const affected = bookmarks.filter((b) => b.categories.includes(cat.name))
		if (affected.length === 0) {
			if (!confirm(`Eliminar la categoria "${cat.name}"?`)) return
			deleteCategory(id).then(() => setCategories((prev) => prev.filter((c) => c.id !== id)))
			return
		}
		setDeletingCat({ id, name: cat.name })
	}

	async function handleConfirmDelete() {
		if (!deletingCat) return
		await deleteCategory(deletingCat.id)
		setCategories((prev) => prev.filter((c) => c.id !== deletingCat.id))
		setDeletingCat(null)
	}

	async function handlePromoteOrphan(catName: string) {
		if (!user) return
		const cat = await createCategory(catName, user.id)
		setCategories((prev) => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)))
	}

	async function handlePurgeOrphan(catName: string) {
		if (!confirm(`Eliminar "${catName}" de tots els recursos que la tinguin?`)) return
		const affected = bookmarks.filter((b) => b.categories.includes(catName))
		for (const b of affected) {
			const newCats = b.categories.filter((c) => c !== catName)
			const updated = await updateBookmark(b.id, { categories: newCats.length > 0 ? newCats : ['Altres'] })
			setBookmarks((prev) => prev.map((bk) => (bk.id === updated.id ? updated : bk)))
		}
	}

	function openProfileModal() {
		setProfileUsername(profile?.username ?? '')
		setProfilePassword('')
		setProfileConfirmPassword('')
		setProfileError('')
		setShowProfileModal(true)
	}

	async function handleSaveProfile() {
		if (!user) return
		if (profilePassword && profilePassword !== profileConfirmPassword) {
			setProfileError('Les contrasenyes no coincideixen.')
			return
		}
		setProfileSaving(true)
		setProfileError('')
		try {
			if (profileUsername.trim() && profileUsername.trim() !== profile?.username) {
				await updateProfile(user.id, profileUsername.trim())
			}
			if (profilePassword) {
				const { error } = await supabase.auth.updateUser({ password: profilePassword })
				if (error) throw error
			}
			await refreshProfile()
			setShowProfileModal(false)
		} catch (err) {
			setProfileError((err as { message?: string })?.message ?? 'Error en guardar')
		} finally {
			setProfileSaving(false)
		}
	}

	const Fallback = () => (
		<div className='min-h-screen flex items-center justify-center'>
			<div className={theme.loadingSpinner} />
		</div>
	)

	if (view === 'changelog')
		return (
			<React.Suspense fallback={<Fallback />}>
				<ChangelogPage onBack={() => setView('public')} onNavigateToBookmark={handleNavigateToBookmark} />
			</React.Suspense>
		)

	if (view === 'editor')
		return (
			<ProtectedRoute>
				<React.Suspense fallback={<Fallback />}>
					<EditorView
						categories={categories}
						onBack={() => setView('public')}
						onBookmarksChange={setBookmarks}
						onCategoriesChange={setCategories}
					/>
				</React.Suspense>
			</ProtectedRoute>
		)

	if (view === 'admin')
		return (
			<ProtectedRoute requireAdmin>
				<React.Suspense fallback={<Fallback />}>
					<AdminView
						categories={categories}
						onCategoriesChange={setCategories}
						onBack={() => setView('public')}
					/>
				</React.Suspense>
			</ProtectedRoute>
		)

	return (
		<div className={theme.page}>
			{/* Header */}
			<header className='bg-surface border-b-4 border-black p-6 shadow-md'>
				<div className='max-w-[1600px] mx-auto flex flex-col xl:flex-row justify-between items-center gap-6'>
					<div className='flex items-center gap-4'>
						<h1 className='text-4xl font-black uppercase tracking-tighter bg-black text-white px-3 py-1 inline-block transform -rotate-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]'>
							SSCE0110 LINKS
						</h1>
						<div className='hidden md:block h-8 w-0.5 bg-black/20' />
						<p className='hidden md:block font-skin text-sm text-gray-600 font-bold'>
							Total: {bookmarks.length} | Categories: {categories.length}
						</p>
					</div>

					<div className='flex flex-wrap gap-2 items-center justify-end'>
						{isAdmin && (
							<>
								<button
									onClick={() => handleChangelogOpen()}
									className='relative flex items-center gap-1.5 font-skin font-bold text-sm px-4 py-2.5 border-skin bg-surface shadow-skin-sm hover:bg-accent transition-colors'
								>
									<span className='hidden sm:inline'>Changelog</span>
									<span className='sm:hidden'>Log</span>
									{changelogBadge > 0 && (
										<span className='absolute -top-2 -right-2 bg-accent text-black text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-black'>
											{changelogBadge > 9 ? '9+' : changelogBadge}
										</span>
									)}
								</button>
								<button
									onClick={handleExport}
									disabled={exporting}
									className='flex items-center gap-1.5 font-skin font-bold text-sm px-4 py-2.5 border-skin bg-surface shadow-skin-sm hover:bg-accent transition-colors disabled:opacity-50'
								>
									<Download size={16} />
									<span className='hidden sm:inline'>{exporting ? 'Exportant...' : 'Exportar'}</span>
								</button>
								<button
									onClick={() => setShowNewResourceForm(true)}
									className='flex items-center gap-1.5 font-skin font-bold text-sm px-4 py-2.5 border-skin bg-surface shadow-skin-sm hover:bg-accent transition-colors'
								>
									<Plus size={16} />
									<span className='hidden sm:inline'>Nou recurs</span>
								</button>
								<button
									onClick={() => setIsCategoryModalOpen(true)}
									className='flex items-center gap-1.5 font-skin font-bold text-sm px-4 py-2.5 border-skin bg-surface shadow-skin-sm hover:bg-accent transition-colors'
								>
									<Settings size={16} />
									<span className='hidden sm:inline'>Categories</span>
								</button>
								<button
									onClick={() => setView('admin')}
									className='flex items-center gap-1.5 font-skin font-bold text-sm px-4 py-2.5 border-skin bg-surface shadow-skin-sm hover:bg-accent transition-colors'
								>
									<User size={16} />
									<span className='hidden sm:inline'>Usuaris</span>
								</button>
								<button
									onClick={() => setShowEditorRequestsAdminModal(true)}
									className='relative flex items-center gap-1.5 font-skin font-bold text-sm px-4 py-2.5 border-skin bg-surface shadow-skin-sm hover:bg-accent transition-colors'
								>
									Editors
									{pendingEditorRequests > 0 && (
										<span className='absolute -top-2 -right-2 bg-accent text-black text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-black'>
											{pendingEditorRequests}
										</span>
									)}
								</button>
								<button
									onClick={() => setShowMessagesModal(true)}
									className='relative flex items-center gap-1.5 font-skin font-bold text-sm px-4 py-2.5 border-skin bg-surface shadow-skin-sm hover:bg-accent transition-colors'
								>
									<MessageSquare size={16} />
									<span className='hidden sm:inline'>Missatges</span>
									{unreadMessages > 0 && (
										<span className='absolute -top-2 -right-2 bg-accent text-black text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-black'>
											{unreadMessages}
										</span>
									)}
								</button>
								<button
									onClick={() => setShowContactsAdminModal(true)}
									className='relative flex items-center gap-1.5 font-skin font-bold text-sm px-4 py-2.5 border-skin bg-surface shadow-skin-sm hover:bg-accent transition-colors'
								>
									<Mail size={16} />
									<span className='hidden sm:inline'>Contactes</span>
									{unreadContacts > 0 && (
										<span className='absolute -top-2 -right-2 bg-accent text-black text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-black'>
											{unreadContacts}
										</span>
									)}
								</button>
							</>
						)}
						{!isAdmin && isEditor && (
							<>
								<button
									onClick={() => handleChangelogOpen()}
									className='relative flex items-center gap-1.5 font-skin font-bold text-sm px-4 py-2.5 border-skin bg-surface shadow-skin-sm hover:bg-accent transition-colors'
								>
									<span className='hidden sm:inline'>Changelog</span>
									<span className='sm:hidden'>Log</span>
									{changelogBadge > 0 && (
										<span className='absolute -top-2 -right-2 bg-accent text-black text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-black'>
											{changelogBadge > 9 ? '9+' : changelogBadge}
										</span>
									)}
								</button>
								<button
									onClick={() => setShowNewResourceForm(true)}
									className='flex items-center gap-1.5 font-skin font-bold text-sm px-4 py-2.5 border-skin bg-surface shadow-skin-sm hover:bg-accent transition-colors'
								>
									<Plus size={16} />
									<span className='hidden sm:inline'>Nou recurs</span>
								</button>
								<button
									onClick={() => setShowEditorCatModal(true)}
									className='flex items-center gap-1.5 font-skin font-bold text-sm px-4 py-2.5 border-skin bg-surface shadow-skin-sm hover:bg-accent transition-colors'
								>
									<Settings size={16} />
									<span className='hidden sm:inline'>Categories</span>
								</button>
								<button
									onClick={() => setView('editor')}
									className='flex items-center gap-1.5 font-skin font-bold text-sm px-4 py-2.5 border-skin bg-surface shadow-skin-sm hover:bg-accent transition-colors'
								>
									<Plus size={16} />
									<span className='hidden sm:inline'>Els meus recursos</span>
									<span className='sm:hidden'>Recursos</span>
								</button>
								<button
									onClick={() => setShowMessagesModal(true)}
									className='relative flex items-center gap-1.5 font-skin font-bold text-sm px-4 py-2.5 border-skin bg-surface shadow-skin-sm hover:bg-accent transition-colors'
								>
									<MessageSquare size={16} />
									<span className='hidden sm:inline'>Missatges</span>
									{unreadMessages > 0 && (
										<span className='absolute -top-2 -right-2 bg-accent text-black text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-black'>
											{unreadMessages}
										</span>
									)}
								</button>
							</>
						)}
						{!user && (
							<>
								<button
									onClick={() => handleChangelogOpen()}
									className='relative flex items-center gap-1.5 font-skin font-bold text-sm px-4 py-2.5 border-skin bg-surface shadow-skin-sm hover:bg-accent transition-colors'
								>
									<span className='hidden sm:inline'>Changelog</span>
									<span className='sm:hidden'>Log</span>
									{changelogBadge > 0 && (
										<span className='absolute -top-2 -right-2 bg-accent text-black text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-black'>
											{changelogBadge > 9 ? '9+' : changelogBadge}
										</span>
									)}
								</button>
								<button
									onClick={() => setShowContactModal(true)}
									className='flex items-center gap-1.5 font-skin font-bold text-sm px-4 py-2.5 border-skin bg-surface shadow-skin-sm hover:bg-accent transition-colors'
								>
									<Mail size={16} />
									<span className='hidden sm:inline'>Contacte</span>
								</button>
							</>
						)}
						{user ? (
							<div className='flex items-center gap-2'>
								<button
									onClick={openProfileModal}
									className='flex items-center gap-1.5 font-skin font-bold text-sm px-4 py-2.5 border-skin bg-black text-white shadow-skin-sm hover:bg-gray-600 transition-colors'
								>
									<User size={16} />
									<span className='hidden sm:inline'>{profile?.username}</span>
								</button>
								<button
									onClick={signOut}
									className='font-skin font-bold text-sm px-4 py-2.5 border-skin bg-surface shadow-skin-sm hover:bg-red-500 hover:text-white hover:border-red-500 transition-all flex items-center gap-2'
									title='Tancar sessió'
								>
									<LogOut size={16} /> LOGOUT
								</button>
							</div>
						) : (
							<button
								onClick={() => setShowLoginModal(true)}
								className='font-skin font-bold text-sm px-5 py-2.5 border-skin bg-accent shadow-skin-sm hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all'
							>
								Accés
							</button>
						)}
					</div>
				</div>
			</header>

			{/* Nav sticky de categories (desktop) */}
			{bookmarks.length > 0 && (
				<div className={theme.stickyNav}>
					<div className='max-w-[1600px] mx-auto flex flex-wrap items-center gap-3'>
						<span className='font-skin font-bold uppercase text-xs text-gray-500 whitespace-nowrap'>
							SALTAR A:
						</span>
						<button
							onClick={() => setIsSearchModalOpen(true)}
							className='px-3 py-1 bg-accent border-skin text-xs font-bold uppercase hover:bg-black hover:text-white transition-colors flex items-center gap-2 whitespace-nowrap shadow-[2px_2px_0px_0px_#000]'
						>
							<Search size={14} /> CERCAR
						</button>
						<div className='flex flex-wrap gap-2'>
							{[...categories]
								.sort((a, b) => a.name.localeCompare(b.name))
								.map((cat) => {
									const count = groupedBookmarks[cat.name]?.length || 0
									const isEditorCat = isAdmin && !!cat.created_by && cat.created_by !== user?.id
									return (
										<button
											key={cat.id}
											onClick={() => scrollToCategory(cat.name)}
											className={`px-3 py-1 border border-black text-xs font-bold uppercase hover:bg-black hover:text-white transition-colors flex items-center gap-2 whitespace-nowrap shadow-[2px_2px_0px_0px_#ccc] ${isEditorCat ? 'bg-blue-100 text-black' : 'bg-surface text-black'}`}
										>
											{cat.name}
											<span className='bg-accent text-black px-1.5 py-0.5 text-[10px] border border-black'>
												{count}
											</span>
										</button>
									)
								})}
							{groupedBookmarks['Altres'] && groupedBookmarks['Altres'].length > 0 && (
								<button
									onClick={() => scrollToCategory('Altres')}
									className='px-3 py-1 bg-blue-100 text-black border border-black text-xs font-bold uppercase hover:bg-black hover:text-white transition-colors flex items-center gap-2 whitespace-nowrap shadow-[2px_2px_0px_0px_#ccc]'
								>
									Altres
									<span className='bg-blue-300 text-black px-1.5 py-0.5 text-[10px] border border-black'>
										{groupedBookmarks['Altres'].length}
									</span>
								</button>
							)}
							{highlightedBookmarks.length > 0 && (
								<button
									onClick={() => scrollToCategory('DESTACAT')}
									className='px-3 py-1 bg-accent border-skin text-xs font-bold uppercase hover:bg-black hover:text-white transition-colors flex items-center gap-2 whitespace-nowrap shadow-[2px_2px_0px_0px_#000]'
								>
									DESTACAT
									<span className='bg-black text-accent px-1.5 py-0.5 text-[10px] border border-black'>
										{highlightedBookmarks.length}
									</span>
								</button>
							)}
						</div>
					</div>
				</div>
			)}

			{/* Botó burger mòbil (fix, centrat) */}
			<div className='md:hidden fixed top-4 left-1/2 -translate-x-1/2 z-50 flex gap-2'>
				<button
					onClick={() => setIsMobileMenuOpen(true)}
					className='bg-accent border-skin px-4 py-2 font-bold font-skin text-sm shadow-skin-sm flex items-center gap-2 active:translate-y-[2px] active:shadow-none'
				>
					<Menu size={18} /> CATEGORIES
				</button>
				{!user && (
					<button
						onClick={() => handleChangelogOpen()}
						className='relative bg-surface border-skin px-3 py-2 font-bold font-skin text-sm shadow-skin-sm flex items-center gap-1.5 active:translate-y-[2px] active:shadow-none hover:bg-accent transition-colors'
					>
						Log
						{changelogBadge > 0 && (
							<span className='absolute -top-2 -right-2 bg-accent text-black text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-black'>
								{changelogBadge > 9 ? '9+' : changelogBadge}
							</span>
						)}
					</button>
				)}
				{!user && (
					<button
						onClick={() => setShowContactModal(true)}
						className='bg-surface border-skin px-3 py-2 font-bold font-skin text-sm shadow-skin-sm flex items-center gap-1.5 active:translate-y-[2px] active:shadow-none hover:bg-accent transition-colors'
					>
						<Mail size={18} />
					</button>
				)}
				{!user && (
					<button
						onClick={() => setShowLoginModal(true)}
						className='bg-black text-white border-skin px-4 py-2 font-bold font-skin text-sm shadow-skin-sm active:translate-y-[2px] active:shadow-none'
					>
						ACCÉS
					</button>
				)}
			</div>

			{/* Botó burger d'accions (fix, esquerra) — visible quan l'usuari és loguejat */}
			{user && (
				<div className='md:hidden fixed top-4 left-4 z-50'>
					<button
						onClick={() => setIsMobileUserMenuOpen(true)}
						className='relative bg-surface border-skin px-3 py-2 font-bold font-skin text-sm shadow-skin-sm flex items-center gap-2 active:translate-y-[2px] active:shadow-none'
					>
						<Menu size={18} />
						{unreadMessages > 0 && (
							<span className='absolute -top-2 -right-2 bg-accent text-black text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-black'>
								{unreadMessages}
							</span>
						)}
					</button>
				</div>
			)}

			{/* Modal mòbil menú d'accions (admin/editor) */}
			{isMobileUserMenuOpen && (
				<div className='fixed inset-0 z-[60] modal-overlay flex items-start justify-start p-4 pt-16'>
					<div className='bg-surface border-4 border-black w-full max-w-xs flex flex-col shadow-skin-lg'>
						<div className='p-4 border-b-2 border-black bg-black text-white flex justify-between items-center'>
							<span className='font-bold font-skin uppercase'>{profile?.username}</span>
							<button onClick={() => setIsMobileUserMenuOpen(false)}>
								<X size={24} />
							</button>
						</div>
						<div className='p-4 flex flex-col gap-3'>
							{isAdmin && (
								<>
									<button
										onClick={() => {
											setIsMobileUserMenuOpen(false)
											handleChangelogOpen()
										}}
										className='font-bold font-skin text-base border-skin p-3 bg-surface hover:bg-accent transition-all flex items-center gap-3 shadow-[4px_4px_0px_0px_#ccc]'
									>
										Changelog
									</button>
									<button
										onClick={() => {
											setIsMobileUserMenuOpen(false)
											handleExport()
										}}
										disabled={exporting}
										className='font-bold font-skin text-base border-skin p-3 bg-surface hover:bg-accent transition-all flex items-center gap-3 shadow-[4px_4px_0px_0px_#ccc] disabled:opacity-50'
									>
										<Download size={18} /> {exporting ? 'Exportant...' : 'Exportar'}
									</button>
									<button
										onClick={() => {
											setIsMobileUserMenuOpen(false)
											setShowNewResourceForm(true)
										}}
										className='font-bold font-skin text-base border-skin p-3 bg-surface hover:bg-accent transition-all flex items-center gap-3 shadow-[4px_4px_0px_0px_#ccc]'
									>
										<Plus size={18} /> Nou recurs
									</button>
									<button
										onClick={() => {
											setIsMobileUserMenuOpen(false)
											setIsCategoryModalOpen(true)
										}}
										className='font-bold font-skin text-base border-skin p-3 bg-surface hover:bg-accent transition-all flex items-center gap-3 shadow-[4px_4px_0px_0px_#ccc]'
									>
										<Settings size={18} /> Categories
									</button>
									<button
										onClick={() => {
											setIsMobileUserMenuOpen(false)
											setView('admin')
										}}
										className='font-bold font-skin text-base border-skin p-3 bg-surface hover:bg-accent transition-all flex items-center gap-3 shadow-[4px_4px_0px_0px_#ccc]'
									>
										<User size={18} /> Usuaris
									</button>
									<button
										onClick={() => {
											setIsMobileUserMenuOpen(false)
											setShowEditorRequestsAdminModal(true)
										}}
										className='relative font-bold font-skin text-base border-skin p-3 bg-surface hover:bg-accent transition-all flex items-center gap-3 shadow-[4px_4px_0px_0px_#ccc]'
									>
										<Settings size={18} /> Editors
										{pendingEditorRequests > 0 && (
											<span className='ml-auto bg-accent text-black text-xs font-bold px-2 py-0.5 border border-black rounded-full'>
												{pendingEditorRequests}
											</span>
										)}
									</button>
									<button
										onClick={() => {
											setIsMobileUserMenuOpen(false)
											setShowMessagesModal(true)
										}}
										className='relative font-bold font-skin text-base border-skin p-3 bg-surface hover:bg-accent transition-all flex items-center gap-3 shadow-[4px_4px_0px_0px_#ccc]'
									>
										<MessageSquare size={18} /> Missatges
										{unreadMessages > 0 && (
											<span className='ml-auto bg-accent text-black text-xs font-bold px-2 py-0.5 border border-black rounded-full'>
												{unreadMessages}
											</span>
										)}
									</button>
									<button
										onClick={() => {
											setIsMobileUserMenuOpen(false)
											setShowContactsAdminModal(true)
										}}
										className='relative font-bold font-skin text-base border-skin p-3 bg-surface hover:bg-accent transition-all flex items-center gap-3 shadow-[4px_4px_0px_0px_#ccc]'
									>
										<Mail size={18} /> Contactes
										{unreadContacts > 0 && (
											<span className='ml-auto bg-accent text-black text-xs font-bold px-2 py-0.5 border border-black rounded-full'>
												{unreadContacts}
											</span>
										)}
									</button>
								</>
							)}
							{!isAdmin && isEditor && (
								<>
									<button
										onClick={() => {
											setIsMobileUserMenuOpen(false)
											handleChangelogOpen()
										}}
										className='font-bold font-skin text-base border-skin p-3 bg-surface hover:bg-accent transition-all flex items-center gap-3 shadow-[4px_4px_0px_0px_#ccc]'
									>
										Changelog
									</button>
									<button
										onClick={() => {
											setIsMobileUserMenuOpen(false)
											setShowNewResourceForm(true)
										}}
										className='font-bold font-skin text-base border-skin p-3 bg-surface hover:bg-accent transition-all flex items-center gap-3 shadow-[4px_4px_0px_0px_#ccc]'
									>
										<Plus size={18} /> Nou recurs
									</button>
									<button
										onClick={() => {
											setIsMobileUserMenuOpen(false)
											setShowEditorCatModal(true)
										}}
										className='font-bold font-skin text-base border-skin p-3 bg-surface hover:bg-accent transition-all flex items-center gap-3 shadow-[4px_4px_0px_0px_#ccc]'
									>
										<Settings size={18} /> Categories
									</button>
									<button
										onClick={() => {
											setIsMobileUserMenuOpen(false)
											setView('editor')
										}}
										className='font-bold font-skin text-base border-skin p-3 bg-surface hover:bg-accent transition-all flex items-center gap-3 shadow-[4px_4px_0px_0px_#ccc]'
									>
										<Plus size={18} /> Els meus recursos
									</button>
									<button
										onClick={() => {
											setIsMobileUserMenuOpen(false)
											setShowMessagesModal(true)
										}}
										className='relative font-bold font-skin text-base border-skin p-3 bg-surface hover:bg-accent transition-all flex items-center gap-3 shadow-[4px_4px_0px_0px_#ccc]'
									>
										<MessageSquare size={18} /> Missatges
										{unreadMessages > 0 && (
											<span className='ml-auto bg-accent text-black text-xs font-bold px-2 py-0.5 border border-black rounded-full'>
												{unreadMessages}
											</span>
										)}
									</button>
								</>
							)}
							<div className='border-t-2 border-black mt-1' />
							<button
								onClick={() => {
									setIsMobileUserMenuOpen(false)
									openProfileModal()
								}}
								className='font-bold font-skin text-base border-skin p-3 bg-surface hover:bg-gray-100 transition-all flex items-center gap-3 shadow-[4px_4px_0px_0px_#ccc]'
							>
								<User size={18} /> Perfil
							</button>
							<button
								onClick={() => {
									setIsMobileUserMenuOpen(false)
									signOut()
								}}
								className='font-bold font-skin text-base border-skin p-3 bg-red-500 text-white hover:bg-red-600 transition-all flex items-center gap-3 shadow-skin-sm'
							>
								<LogOut size={18} /> LOGOUT
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Modal mòbil de categories */}
			{isMobileMenuOpen && (
				<div className='fixed inset-0 z-[60] modal-overlay flex items-center justify-center p-4'>
					<div className='bg-surface border-4 border-black w-full max-w-sm max-h-[80vh] overflow-y-auto flex flex-col shadow-[8px_8px_0px_0px_#fff]'>
						<div className='p-4 border-b-2 border-black bg-accent flex justify-between items-center'>
							<h2 className='font-bold text-xl uppercase font-skin'>Categories</h2>
							<button onClick={() => setIsMobileMenuOpen(false)}>
								<X size={24} />
							</button>
						</div>
						<div className='p-4 flex flex-col gap-3'>
							<button
								onClick={() => {
									setIsMobileMenuOpen(false)
									setIsSearchModalOpen(true)
								}}
								className='text-left font-bold font-skin text-lg border-skin p-3 bg-accent hover:bg-black hover:text-white transition-all flex justify-between items-center shadow-skin-sm'
							>
								<span className='flex items-center gap-2'>
									<Search size={18} /> CERCAR
								</span>
							</button>
							{[...categories]
								.sort((a, b) => a.name.localeCompare(b.name))
								.map((cat) => {
									const count = groupedBookmarks[cat.name]?.length || 0
									const isEditorCat = isAdmin && !!cat.created_by && cat.created_by !== user?.id
									return (
										<button
											key={cat.id}
											onClick={() => scrollToCategory(cat.name)}
											className={`text-left font-bold font-skin text-lg border-skin p-3 hover:bg-black hover:text-white transition-all flex justify-between items-center shadow-[4px_4px_0px_0px_#ccc] ${isEditorCat ? 'bg-blue-100' : 'bg-surface'}`}
										>
											{cat.name}
											<span className='bg-accent-hover text-black text-xs px-2 py-1 border border-black'>
												{count}
											</span>
										</button>
									)
								})}
							{groupedBookmarks['Altres'] && groupedBookmarks['Altres'].length > 0 && (
								<button
									onClick={() => scrollToCategory('Altres')}
									className='text-left font-bold font-skin text-lg border-skin p-3 hover:bg-black hover:text-white transition-all flex justify-between items-center bg-blue-100 shadow-[4px_4px_0px_0px_#ccc]'
								>
									Altres
									<span className='bg-blue-300 text-black text-xs px-2 py-1 border border-black'>
										{groupedBookmarks['Altres'].length}
									</span>
								</button>
							)}
							{highlightedBookmarks.length > 0 && (
								<button
									onClick={() => scrollToCategory('DESTACAT')}
									className='text-left font-bold font-skin text-lg border-skin p-3 hover:bg-black hover:text-white transition-all flex justify-between items-center bg-accent shadow-skin-sm'
								>
									<span>DESTACAT</span>
									<span className='bg-black text-accent text-xs px-2 py-1 border border-black'>
										{displayHighlighted.length}
									</span>
								</button>
							)}
							<div className='border-t-2 border-black mt-1' />
							<button
								onClick={() => { setIsMobileMenuOpen(false); handleChangelogOpen() }}
								className='font-bold font-skin text-lg border-skin p-3 bg-surface hover:bg-accent transition-all flex items-center justify-start shadow-[4px_4px_0px_0px_#ccc]'
							>
								Changelog
							</button>
							{!user && (
								<>
									<button
										onClick={() => {
											setIsMobileMenuOpen(false)
											setShowLoginModal(true)
										}}
										className='font-bold font-skin text-lg border-skin p-3 bg-black text-white hover:bg-gray-800 transition-all flex items-center justify-center shadow-skin-sm'
									>
										ACCÉS
									</button>
								</>
							)}
						</div>
					</div>
				</div>
			)}

			{/* Contingut principal */}
			<main className='max-w-[1600px] mx-auto p-6 flex flex-col gap-12 mt-4 md:mt-4 pt-16 md:pt-4'>
				{/* Estat buit */}
				{bookmarks.length === 0 && !loading && (
					<div className='text-center py-32 border-4 border-dashed border-gray-300 m-8 bg-gray-50'>
						<p className='font-skin text-3xl font-bold text-gray-400 mb-4'>Sense recursos</p>
						<p className='font-skin text-gray-500'>
							{user
								? 'Afegeix el primer recurs des de "Els meus recursos".'
								: 'Accedeix com a editor per afegir recursos.'}
						</p>
					</div>
				)}

				{/* Resultats de cerca */}
				{searchQuery && (
					<div>
						<div className='flex items-center gap-4 mb-6 flex-wrap'>
							<h2 className='text-3xl font-black uppercase bg-accent text-black px-4 py-2 inline-block shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] border-skin'>
								Resultats: "{searchQuery}"
							</h2>
							<span className='font-skin font-bold text-xl text-gray-500'>
								{searchResults.length} resultat{searchResults.length !== 1 ? 's' : ''}
							</span>
							<button
								onClick={() => setSearchQuery('')}
								className='font-skin font-bold text-sm px-4 py-2 border-skin bg-surface hover:bg-gray-100 transition-colors shadow-[2px_2px_0px_0px_#000]'
							>
								✕ Netejar cerca
							</button>
						</div>
						{searchResults.length === 0 ? (
							<div className='text-center py-20'>
								<p className='font-skin text-xl text-gray-600'>Cap resultat per "{searchQuery}"</p>
							</div>
						) : (
							<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6'>
								{searchResults.map((b) => (
									<BookmarkCard
										key={b.id}
										bookmark={{
											...b,
											highlighted: isAdmin ? b.highlighted : isPersonalHighlight(b.id),
										}}
										canEdit={isAdmin || (isEditor && b.user_id === user?.id)}
										canHighlight={isAdmin || isEditor}
										onEdit={handleEditBookmark}
										onDelete={handleDelete}
										onToggleHighlight={
											isAdmin ? handleToggleHighlight : handleToggleEditorHighlight
										}
										isOrphan={orphanBookmarkIds.has(b.id)}
										isUnreviewed={isAdmin && !b.admin_reviewed && b.user_id !== user?.id}
										isNew={newBookmarkIds.has(b.id)}
									/>
								))}
							</div>
						)}
					</div>
				)}

				{/* Seccions per categoria */}
				{!searchQuery &&
					[...categories]
						.sort((a, b) => a.name.localeCompare(b.name))
						.map((cat) => {
							const items = groupedBookmarks[cat.name]
							if (!items || items.length === 0) return null
							return (
								<div key={cat.id} id={`category-${cat.name}`} className='scroll-mt-48'>
									<div className='flex items-center gap-4 mb-6'>
										<h2 className='text-3xl font-black uppercase bg-black text-white px-4 py-2 inline-block shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)]'>
											{cat.name}
										</h2>
										<span className='font-skin font-bold text-xl text-gray-500'>
											{items.length}
										</span>
										<div className='h-1 flex-grow bg-black' />
									</div>
									<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6'>
										{items.map((b) => (
											<BookmarkCard
												key={b.id}
												bookmark={{
													...b,
													highlighted: isAdmin ? b.highlighted : isPersonalHighlight(b.id),
												}}
												canEdit={isAdmin || (isEditor && b.user_id === user?.id)}
												canHighlight={isAdmin || isEditor}
												onEdit={handleEditBookmark}
												onDelete={handleDelete}
												onToggleHighlight={
													isAdmin ? handleToggleHighlight : handleToggleEditorHighlight
												}
												isOrphan={orphanBookmarkIds.has(b.id)}
												isUnreviewed={isAdmin && !b.admin_reviewed && b.user_id !== user?.id}
												isNew={newBookmarkIds.has(b.id)}
											/>
										))}
									</div>
								</div>
							)
						})}

				{/* Secció Altres */}
				{!searchQuery && groupedBookmarks['Altres'] && groupedBookmarks['Altres'].length > 0 && (
					<div id='category-Altres' className='scroll-mt-48'>
						<div className='flex items-center gap-4 mb-6'>
							<h2 className='text-3xl font-black uppercase bg-blue-100 text-black px-4 py-2 inline-block border-skin shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)]'>
								Altres
							</h2>
							<span className='font-skin font-bold text-xl text-gray-500'>
								{groupedBookmarks['Altres'].length}
							</span>
							<div className='h-1 flex-grow bg-blue-200 border border-black' />
							{isAdmin && (
								<span className='font-skin text-xs text-blue-600 font-bold uppercase'>
									Recursos sense categoria assignada
								</span>
							)}
						</div>
						<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6'>
							{groupedBookmarks['Altres'].map((b) => (
								<BookmarkCard
									key={b.id}
									bookmark={{
										...b,
										highlighted: isAdmin ? b.highlighted : isPersonalHighlight(b.id),
									}}
									canEdit={isAdmin || (isEditor && b.user_id === user?.id)}
									canHighlight={isAdmin || isEditor}
									onEdit={handleEditBookmark}
									onDelete={handleDelete}
									onToggleHighlight={isAdmin ? handleToggleHighlight : handleToggleEditorHighlight}
									isOrphan={orphanBookmarkIds.has(b.id)}
									isUnreviewed={isAdmin && !b.admin_reviewed && b.user_id !== user?.id}
									isNew={newBookmarkIds.has(b.id)}
								/>
							))}
						</div>
					</div>
				)}

				{/* Secció virtual DESTACAT */}
				{!searchQuery && displayHighlighted.length > 0 && (
					<div id='category-DESTACAT' className='scroll-mt-48'>
						<div className='flex items-center gap-4 mb-6'>
							<h2 className='text-3xl font-black uppercase bg-accent text-black px-4 py-2 inline-block border-skin shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)]'>
								DESTACAT
							</h2>
							<span className='font-skin font-bold text-xl text-gray-500'>
								{displayHighlighted.length}
							</span>
							<div className='h-1 flex-grow bg-accent border border-black' />
						</div>
						<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6'>
							{displayHighlighted.map((b) => (
								<BookmarkCard
									key={b.id}
									bookmark={{ ...b, highlighted: true }}
									canEdit={isAdmin || (isEditor && b.user_id === user?.id)}
									canHighlight={isAdmin || isEditor}
									onEdit={handleEditBookmark}
									onDelete={handleDelete}
									onToggleHighlight={isAdmin ? handleToggleHighlight : handleToggleEditorHighlight}
									isOrphan={orphanBookmarkIds.has(b.id)}
									isUnreviewed={isAdmin && !b.admin_reviewed && b.user_id !== user?.id}
									isNew={newBookmarkIds.has(b.id)}
								/>
							))}
						</div>
					</div>
				)}
			</main>

			{/* Modal d'edició */}
			{editingBookmark && (
				<div className='fixed inset-0 z-50 modal-overlay flex items-center justify-center p-4'>
					<BookmarkForm
						bookmark={editingBookmark}
						categories={categories}
						userId={editingBookmark.user_id}
						onSave={handleEditSave}
						onCancel={() => setEditingBookmark(null)}
					/>
				</div>
			)}

			{/* Modal de cerca */}
			{isSearchModalOpen && (
				<div className='fixed inset-0 z-[100] modal-overlay flex items-center justify-center p-4'>
					<div className='w-full max-w-xl relative'>
						<button
							onClick={() => setIsSearchModalOpen(false)}
							className='absolute -top-3 -right-3 z-10 p-1.5 bg-surface border-2 border-black hover:bg-black hover:text-white transition-colors shadow-[2px_2px_0px_0px_#000]'
						>
							<X size={18} />
						</button>
						<div className='bg-accent border-4 border-black p-4 shadow-[8px_8px_0px_0px_#000]'>
							<h2 className='font-black font-mono text-xl uppercase tracking-wider'>Cercar Recursos</h2>
						</div>
						<div className='bg-white border-4 border-t-0 border-black p-6 shadow-[8px_8px_0px_0px_#000] space-y-4'>
							<input
								type='text'
								autoFocus
								placeholder='Cercar per títol, descripció o URL...'
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(searchQuery) }}
								className='w-full bg-surface border-skin p-3 font-skin focus:outline-none focus:bg-orange-50 placeholder-gray-500 shadow-[2px_2px_0px_0px_#ccc] focus:shadow-[2px_2px_0px_0px_#000] transition-all'
							/>
							<div className='flex justify-end gap-3'>
								<button onClick={() => setIsSearchModalOpen(false)} className='font-skin font-bold text-sm px-4 py-2 border-skin bg-surface shadow-skin-sm hover:bg-gray-100 transition-colors'>
									Cancel·lar
								</button>
								<button onClick={() => handleSearch(searchQuery)} className='font-skin font-bold text-sm px-4 py-2 border-skin bg-black text-white shadow-skin-sm hover:bg-gray-800 flex items-center gap-2 transition-colors'>
									<Search size={16} /> Cercar
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Modal categories */}
			{isCategoryModalOpen && (
				<div className='fixed inset-0 z-50 modal-overlay flex items-center justify-center p-4'>
					<div className='w-full max-w-md relative'>
						<button
							onClick={() => { setIsCategoryModalOpen(false); setNewCategoryName('') }}
							className='absolute -top-3 -right-3 z-10 p-1.5 bg-surface border-2 border-black hover:bg-black hover:text-white transition-colors shadow-[2px_2px_0px_0px_#000]'
						>
							<X size={18} />
						</button>
						<div className='bg-accent border-4 border-black p-4 shadow-[8px_8px_0px_0px_#000]'>
							<h2 className='font-black font-mono text-xl uppercase tracking-wider'>Categories</h2>
						</div>
						<div className='bg-white border-4 border-t-0 border-black shadow-[8px_8px_0px_0px_#000]'>
						<div className='p-6 space-y-4'>
							<div className='flex gap-2'>
								<input
									type='text'
									placeholder='Nova categoria...'
									value={newCategoryName}
									onChange={(e) => setNewCategoryName(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === 'Enter') handleAddCategory()
									}}
									className='flex-grow border-skin p-2 font-skin text-sm focus:outline-none focus:bg-orange-50'
								/>
								<button
									onClick={handleAddCategory}
									disabled={!newCategoryName.trim()}
									className='font-skin font-bold text-sm px-4 py-2 border-skin bg-accent hover:bg-accent-hover disabled:opacity-40 transition-colors flex items-center gap-1'
								>
									<Plus size={14} /> Afegir
								</button>
							</div>
							<ul className='space-y-2 max-h-60 overflow-y-auto'>
								{[...categories]
									.sort((a, b) => a.name.localeCompare(b.name))
									.map((cat) => {
										const isEditorCat = !!cat.created_by && cat.created_by !== user?.id
										return (
											<li
												key={cat.id}
												className={`flex items-center gap-2 p-3 border-skin ${isEditorCat ? 'bg-blue-100' : ''}`}
											>
												{editingCat?.id === cat.id ? (
													<>
														<input
															autoFocus
															value={editingCat.name}
															onChange={(e) =>
																setEditingCat({ ...editingCat, name: e.target.value })
															}
															onKeyDown={(e) => {
																if (e.key === 'Enter')
																	handleUpdateCategory(cat.id, editingCat.name)
																if (e.key === 'Escape') setEditingCat(null)
															}}
															className='flex-grow border-skin p-1 font-skin text-sm focus:outline-none focus:bg-orange-50'
														/>
														<button
															onClick={() =>
																handleUpdateCategory(cat.id, editingCat.name)
															}
															className='p-1.5 hover:bg-green-100 border border-transparent hover:border-black transition-colors'
															title='Guardar'
														>
															<Check size={14} />
														</button>
														<button
															onClick={() => setEditingCat(null)}
															className='p-1.5 hover:bg-gray-100 border border-transparent hover:border-black transition-colors'
															title='Cancel·lar'
														>
															<X size={14} />
														</button>
													</>
												) : (
													<>
														<span className='font-skin flex-grow'>{cat.name}</span>
														<button
															onClick={() =>
																setEditingCat({ id: cat.id, name: cat.name })
															}
															className='p-1.5 hover:bg-orange-100 border border-transparent hover:border-black transition-colors'
															title='Editar'
														>
															<Edit2 size={14} />
														</button>
														<button
															onClick={() => handleDeleteCategory(cat.id)}
															className='p-1.5 hover:bg-red-100 border border-transparent hover:border-black transition-colors'
															title='Eliminar'
														>
															<Trash2 size={14} />
														</button>
													</>
												)}
											</li>
										)
									})}
							</ul>

							{orphanCategories.length > 0 && (
								<div className='mt-4 border-t-2 border-black pt-4'>
									<p className='font-skin text-xs font-bold uppercase text-orange-600 mb-2'>
										Categories òrfenes ({orphanCategories.length}) — existeixen en recursos però no
										a la taula
									</p>
									<ul className='space-y-2'>
										{orphanCategories.map((catName) => (
											<li
												key={catName}
												className='flex items-center justify-between p-3 border-2 border-orange-400 bg-orange-50'
											>
												<span className='font-skin font-bold'>{catName}</span>
												<div className='flex gap-2'>
													<button
														onClick={() => handlePromoteOrphan(catName)}
														className='font-skin text-xs font-bold px-2 py-1 border-skin bg-accent hover:bg-accent-hover transition-colors'
														title='Crear-la com a categoria oficial'
													>
														+ Crear
													</button>
													<button
														onClick={() => handlePurgeOrphan(catName)}
														className='font-skin text-xs font-bold px-2 py-1 border-skin bg-surface hover:bg-red-100 transition-colors'
														title='Eliminar de tots els recursos'
													>
														Purgar
													</button>
												</div>
											</li>
										))}
									</ul>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
			)}

			{/* Modal confirmació eliminar categoria amb recursos */}
			{deletingCat && (
				<div className='fixed inset-0 z-[60] modal-overlay flex items-center justify-center p-4'>
					<div className='w-full max-w-sm relative'>
						<button
							onClick={() => setDeletingCat(null)}
							className='absolute -top-3 -right-3 z-10 p-1.5 bg-surface border-2 border-black hover:bg-black hover:text-white transition-colors shadow-[2px_2px_0px_0px_#000]'
						>
							<X size={18} />
						</button>
						<div className='bg-accent border-4 border-black p-4 shadow-[8px_8px_0px_0px_#000]'>
							<h2 className='font-black font-mono text-xl uppercase tracking-wider'>Eliminar categoria</h2>
						</div>
						<div className='bg-white border-4 border-t-0 border-black p-6 shadow-[8px_8px_0px_0px_#000] space-y-4'>
							<p className='font-skin text-sm text-gray-600'>
								La categoria <strong>"{deletingCat.name}"</strong> s'usa en{' '}
								<strong>
									{bookmarks.filter((b) => b.categories.includes(deletingCat.name)).length} recursos
								</strong>
								.
							</p>
							<p className='font-skin text-sm text-blue-700 bg-blue-50 border border-blue-200 px-3 py-2'>
								Els recursos quedaran sense categoria i es mostraran a "Altres" amb fons blau fins que els
								editeu i n'assigneu una de nova.
							</p>
							<div className='flex gap-3 justify-end'>
								<Button variant='secondary' onClick={() => setDeletingCat(null)}>Cancel·lar</Button>
								<Button variant='danger' onClick={handleConfirmDelete}>Eliminar</Button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Modal nou recurs (admin) */}
			{showNewResourceForm && user && (
				<div className='fixed inset-0 z-50 modal-overlay flex items-center justify-center p-4'>
					<BookmarkForm
						categories={categories}
						userId={user.id}
						onSave={handleCreateBookmark}
						onCancel={() => setShowNewResourceForm(false)}
					/>
				</div>
			)}

			{/* Modal categories editor */}
			{showEditorCatModal && (
				<div className='fixed inset-0 z-50 modal-overlay flex items-center justify-center p-4'>
					<div className='w-full max-w-md relative'>
						<button
							onClick={() => {
								setShowEditorCatModal(false)
								setEditorNewCatName('')
								setEditorCatError('')
								setEditorEditingCat(null)
							}}
							className='absolute -top-3 -right-3 z-10 p-1.5 bg-surface border-2 border-black hover:bg-black hover:text-white transition-colors shadow-[2px_2px_0px_0px_#000]'
						>
							<X size={18} />
						</button>
						<div className='bg-accent border-4 border-black p-4 shadow-[8px_8px_0px_0px_#000]'>
							<h2 className='font-black font-mono text-xl uppercase tracking-wider'>Les meves categories</h2>
						</div>
						<div className='bg-white border-4 border-t-0 border-black p-6 shadow-[8px_8px_0px_0px_#000] space-y-4'>
							<div className='flex gap-2'>
								<input
									type='text'
									placeholder='Nova categoria...'
									value={editorNewCatName}
									onChange={(e) => setEditorNewCatName(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === 'Enter') handleEditorAddCat()
									}}
									className='flex-grow border-skin p-2 font-skin text-sm focus:outline-none focus:bg-orange-50'
									autoFocus
								/>
								<button
									onClick={handleEditorAddCat}
									disabled={!editorNewCatName.trim()}
									className='font-skin font-bold text-sm px-4 py-2 border-skin bg-accent hover:bg-accent-hover disabled:opacity-40 transition-colors flex items-center gap-1'
								>
									<Plus size={14} /> Afegir
								</button>
							</div>
							{editorCatError && (
								<p className='font-skin text-xs text-red-600 border border-red-300 bg-red-50 px-3 py-2'>
									{editorCatError}
								</p>
							)}
							{categories.filter((c) => c.created_by === user?.id).length > 0 ? (
								<ul className='space-y-2 max-h-64 overflow-y-auto'>
									{categories
										.filter((c) => c.created_by === user?.id)
										.map((cat) => (
											<li key={cat.id} className='flex items-center gap-2 p-3 border-skin'>
												{editorEditingCat?.id === cat.id ? (
													<>
														<input
															autoFocus
															value={editorEditingCat.name}
															onChange={(e) =>
																setEditorEditingCat({
																	...editorEditingCat,
																	name: e.target.value,
																})
															}
															onKeyDown={(e) => {
																if (e.key === 'Enter')
																	handleEditorEditCat(cat.id, editorEditingCat.name)
																if (e.key === 'Escape') setEditorEditingCat(null)
															}}
															className='flex-grow border-skin p-1 font-skin text-sm focus:outline-none focus:bg-orange-50'
														/>
														<button
															onClick={() =>
																handleEditorEditCat(cat.id, editorEditingCat.name)
															}
															className='p-1.5 hover:bg-green-100 border border-transparent hover:border-black transition-colors'
														>
															<Check size={14} />
														</button>
														<button
															onClick={() => setEditorEditingCat(null)}
															className='p-1.5 hover:bg-gray-100 border border-transparent hover:border-black transition-colors'
														>
															<X size={14} />
														</button>
													</>
												) : (
													<>
														<span className='font-skin flex-grow'>{cat.name}</span>
														<button
															onClick={() =>
																setEditorEditingCat({ id: cat.id, name: cat.name })
															}
															className='p-1.5 hover:bg-orange-100 border border-transparent hover:border-black transition-colors'
														>
															<Edit2 size={14} />
														</button>
														<button
															onClick={() => handleEditorDeleteCat(cat.id, cat.name)}
															className='p-1.5 hover:bg-red-100 border border-transparent hover:border-black transition-colors'
														>
															<Trash2 size={14} />
														</button>
													</>
												)}
											</li>
										))}
								</ul>
							) : (
								<p className='font-skin text-sm text-gray-400 text-center py-4'>
									Encara no has creat cap categoria.
								</p>
							)}
						</div>
					</div>
				</div>
			)}

			{/* Modal login */}
			{showLoginModal && (
				<LoginPage
					onClose={() => setShowLoginModal(false)}
					onRequestAccess={() => {
						setShowLoginModal(false)
						setShowEditorRequestModal(true)
					}}
				/>
			)}

			{/* Modal missatges */}
			{showMessagesModal && (
				<MessagesModal onClose={() => setShowMessagesModal(false)} onUnreadChange={setUnreadMessages} />
			)}

			{/* Modal contacte (públic) */}
			{showContactModal && <ContactModal onClose={() => setShowContactModal(false)} />}

			{/* Modal sol·licitud editor */}
			{showEditorRequestModal && (
				<EditorRequestModal
					onClose={() => setShowEditorRequestModal(false)}
					onGoToLogin={() => {
						setShowEditorRequestModal(false)
						setShowLoginModal(true)
					}}
				/>
			)}

			{/* Modal sol·licituds admin */}
			{showEditorRequestsAdminModal && (
				<EditorRequestsAdminModal
					onClose={() => setShowEditorRequestsAdminModal(false)}
					onPendingChange={setPendingEditorRequests}
				/>
			)}

			{/* Modal contactes admin */}
			{showContactsAdminModal && (
				<ContactsAdminModal
					onClose={() => setShowContactsAdminModal(false)}
					onUnreadChange={setUnreadContacts}
				/>
			)}

			{/* Modal perfil d'usuari */}
			{showProfileModal && (
				<div className='fixed inset-0 z-50 modal-overlay flex items-center justify-center p-4'>
					<div className='w-full max-w-md relative'>
						<button
							onClick={() => setShowProfileModal(false)}
							className='absolute -top-3 -right-3 z-10 p-1.5 bg-surface border-2 border-black hover:bg-black hover:text-white transition-colors shadow-[2px_2px_0px_0px_#000]'
						>
							<X size={18} />
						</button>
						<div className='bg-accent border-4 border-black p-4 shadow-[8px_8px_0px_0px_#000]'>
							<h2 className='font-black font-mono text-xl uppercase tracking-wider'>El meu perfil</h2>
						</div>
						<div className='bg-white border-4 border-t-0 border-black p-6 shadow-[8px_8px_0px_0px_#000] space-y-4'>
							<div>
								<Label>Nom d'usuari</Label>
								<Input
									type='text'
									value={profileUsername}
									onChange={(e) => setProfileUsername(e.target.value)}
								/>
							</div>
							<div>
								<Label>Email</Label>
								<Input
									type='email'
									value={user?.email ?? ''}
									readOnly
									className='w-full bg-surface border-skin p-3 font-skin focus:outline-none bg-gray-50 text-gray-400 cursor-not-allowed shadow-[2px_2px_0px_0px_#ccc]'
								/>
							</div>
							<div>
								<Label>Contrasenya nova</Label>
								<Input
									type='password'
									value={profilePassword}
									onChange={(e) => setProfilePassword(e.target.value)}
									placeholder='Deixa en blanc per no canviar'
								/>
							</div>
							<div>
								<Label>Confirma la contrasenya</Label>
								<Input
									type='password'
									value={profileConfirmPassword}
									onChange={(e) => setProfileConfirmPassword(e.target.value)}
									placeholder='Repeteix la contrasenya nova'
								/>
							</div>
							{profileError && (
								<p className='font-skin text-xs text-red-600 border border-red-300 bg-red-50 px-3 py-2'>
									{profileError}
								</p>
							)}
							<div className='flex justify-end gap-3 pt-2'>
								<Button variant='secondary' onClick={() => setShowProfileModal(false)}>Cancel·lar</Button>
								<Button
									onClick={handleSaveProfile}
									disabled={profileSaving || !profileUsername.trim()}
								>
									{profileSaving ? 'Guardant...' : 'Guardar'}
								</Button>
							</div>
						</div>
					</div>
				</div>
			)}

			{showSetPasswordModal && (
				<SetPasswordModal onSuccess={() => setShowSetPasswordModal(false)} />
			)}

			<ScrollToTop />
			<SkinPicker />
		</div>
	)
}
