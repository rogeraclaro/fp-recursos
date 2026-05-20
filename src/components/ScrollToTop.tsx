import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

export const ScrollToTop: React.FC = () => {
	const [isVisible, setIsVisible] = useState(false);

	// Show button when page is scrolled down
	useEffect(() => {
		const toggleVisibility = () => {
			if (window.scrollY > 400) {
				setIsVisible(true);
			} else {
				setIsVisible(false);
			}
		};

		window.addEventListener('scroll', toggleVisibility);

		return () => {
			window.removeEventListener('scroll', toggleVisibility);
		};
	}, []);

	const scrollToTop = () => {
		window.scrollTo({
			top: 0,
			behavior: 'smooth',
		});
	};

	if (!isVisible) return null;

	return (
		<button
			onClick={scrollToTop}
			className='scroll-to-top fixed bottom-6 right-6 z-40 p-3 border-skin shadow-skin-sm hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-skin-md active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-200'
			aria-label='Tornar a dalt'
			title='Tornar a dalt'
		>
			<ArrowUp size={20} strokeWidth={3} className='text-black' />
		</button>
	);
};
