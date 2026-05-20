import React from 'react'
import { LogOut, Settings, Plus, ArrowLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

type View = 'public' | 'editor' | 'admin'

interface Props {
	view: View
	onChangeView: (v: View) => void
	onNewResource?: () => void
	onCategories?: () => void
}

export const Header: React.FC<Props> = ({ view, onChangeView, onNewResource, onCategories }) => {
	const { user, profile, signOut, isAdmin, isEditor } = useAuth()

	return (
		<header className='bg-surface border-b-4 border-black p-4 shadow-md'>
			<div className='max-w-[1600px] mx-auto flex items-center justify-between gap-4'>
				{/* Logo */}
				<button onClick={() => onChangeView('public')} className='hover:opacity-80 transition-opacity'>
					<h1 className='text-4xl font-black uppercase tracking-tighter bg-black text-white px-3 py-1 inline-block transform -rotate-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]'>
						FP Recursos
					</h1>
				</button>

				{/* Nav + accions */}
				<div className='flex items-center gap-2 flex-wrap justify-end'>
					{view === 'editor' && (
						<button
							onClick={() => onChangeView('public')}
							className='flex items-center gap-1.5 font-skin font-bold text-sm px-4 py-2.5 border-skin bg-surface shadow-skin-sm hover:bg-accent transition-colors'
						>
							<ArrowLeft size={14} />
							<span className='hidden sm:inline'>Tornar enrere</span>
						</button>
					)}
					{onNewResource && (
						<button
							onClick={onNewResource}
							className='flex items-center gap-1.5 font-skin font-bold text-sm px-4 py-2.5 border-skin bg-surface shadow-skin-sm hover:bg-accent transition-colors'
						>
							<Plus size={14} />
							<span className='hidden sm:inline'>Nou recurs</span>
						</button>
					)}
					{onCategories && (
						<button
							onClick={onCategories}
							className='flex items-center gap-1.5 font-skin font-bold text-sm px-4 py-2.5 border-skin bg-surface shadow-skin-sm hover:bg-accent transition-colors'
						>
							<Settings size={14} />
							<span className='hidden sm:inline'>Categories</span>
						</button>
					)}
					{isEditor && view !== 'editor' && (
						<button
							onClick={() => onChangeView('editor')}
							className='flex items-center gap-1 font-skin text-sm px-3 py-1.5 border-skin hover:bg-accent transition-colors shadow-[2px_2px_0px_0px_#000]'
						>
							<Plus size={14} />
							<span className='hidden sm:inline'>Els meus recursos</span>
							<span className='sm:hidden'>Recursos</span>
						</button>
					)}
					{isAdmin && view !== 'admin' && (
						<button
							onClick={() => onChangeView('admin')}
							className='flex items-center gap-1 font-skin text-sm px-3 py-1.5 border-skin hover:bg-accent transition-colors shadow-[2px_2px_0px_0px_#000]'
						>
							<Settings size={14} />
							Admin
						</button>
					)}
					{user ? (
						<div className='flex items-center gap-2'>
							<span className='font-skin text-xs text-gray-500 hidden sm:block'>{profile?.username}</span>
							<button
								onClick={signOut}
								className='font-skin font-bold text-sm px-4 py-2.5 border-skin bg-surface shadow-skin-sm hover:bg-red-500 hover:text-white hover:border-red-500 transition-all flex items-center gap-2'
								title='Tancar sessió'
							>
								<LogOut size={16} /> Logout
							</button>
						</div>
					) : (
						<button
							onClick={() => onChangeView('editor')}
							className='font-skin text-sm px-3 py-1.5 border-skin hover:bg-accent transition-colors shadow-[2px_2px_0px_0px_#000]'
						>
							Accés editors
						</button>
					)}
				</div>
			</div>
		</header>
	)
}
