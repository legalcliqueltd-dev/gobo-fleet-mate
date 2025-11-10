'use client';
import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MenuToggleIcon } from '@/components/ui/menu-toggle-icon';
import { createPortal } from 'react-dom';
import { Truck } from 'lucide-react';

export function Header3() {
	const [open, setOpen] = React.useState(false);
	const scrolled = useScroll(10);

	React.useEffect(() => {
		if (open) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = '';
		}
		return () => {
			document.body.style.overflow = '';
		};
	}, [open]);

	return (
		<header
			className={cn('sticky top-0 z-50 w-full border-b border-transparent', {
				'bg-background/95 supports-[backdrop-filter]:bg-background/50 border-border backdrop-blur-lg':
					scrolled,
			})}
		>
			<nav className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
				<div className="flex items-center gap-5">
					<a href="/" className="hover:bg-accent rounded-md p-2 flex items-center gap-2">
						<div className="w-8 h-8 bg-gradient-to-r from-primary to-primary/80 rounded-lg flex items-center justify-center">
							<Truck className="w-5 h-5 text-primary-foreground" />
						</div>
						<span className="font-bold text-lg gradient-text">FTM</span>
					</a>
					<nav className="hidden md:flex items-center space-x-8">
						<a
							href="#features"
							className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
						>
							Features
						</a>
						<a
							href="#dashboard"
							className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
						>
							Dashboard
						</a>
						<a
							href="#pricing"
							className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
						>
							Pricing
						</a>
						<a
							href="#contact"
							className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
						>
							Contact
						</a>
					</nav>
				</div>
				<div className="hidden items-center gap-2 md:flex">
					<Button variant="outline" asChild>
						<a href="/auth/login">Sign In</a>
					</Button>
					<Button asChild>
						<a href="/auth/signup">Get Started</a>
					</Button>
				</div>
				<Button
					size="icon"
					variant="outline"
					onClick={() => setOpen(!open)}
					className="md:hidden"
					aria-expanded={open}
					aria-controls="mobile-menu"
					aria-label="Toggle menu"
				>
					<MenuToggleIcon open={open} className="size-5" duration={300} />
				</Button>
			</nav>
			<MobileMenu open={open} className="flex flex-col justify-between gap-2 overflow-y-auto">
				<div className="flex flex-col gap-4">
					<a
						href="#features"
						className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
						onClick={() => setOpen(false)}
					>
						Features
					</a>
					<a
						href="#dashboard"
						className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
						onClick={() => setOpen(false)}
					>
						Dashboard
					</a>
					<a
						href="#pricing"
						className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
						onClick={() => setOpen(false)}
					>
						Pricing
					</a>
					<a
						href="#contact"
						className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
						onClick={() => setOpen(false)}
					>
						Contact
					</a>
				</div>
				<div className="flex flex-col gap-2">
					<Button variant="outline" className="w-full bg-transparent" asChild>
						<a href="/auth/login">Sign In</a>
					</Button>
					<Button className="w-full" asChild>
						<a href="/auth/signup">Get Started</a>
					</Button>
				</div>
			</MobileMenu>
		</header>
	);
}

type MobileMenuProps = React.ComponentProps<'div'> & {
	open: boolean;
};

function MobileMenu({ open, children, className, ...props }: MobileMenuProps) {
	if (!open || typeof window === 'undefined') return null;

	return createPortal(
		<div
			id="mobile-menu"
			className={cn(
				'bg-background/95 supports-[backdrop-filter]:bg-background/50 backdrop-blur-lg',
				'fixed top-14 right-0 bottom-0 left-0 z-40 flex flex-col overflow-hidden border-y md:hidden',
			)}
		>
			<div
				data-slot={open ? 'open' : 'closed'}
				className={cn(
					'data-[slot=open]:animate-in data-[slot=open]:zoom-in-97 ease-out',
					'size-full p-4',
					className,
				)}
				{...props}
			>
				{children}
			</div>
		</div>,
		document.body,
	);
}

function useScroll(threshold: number) {
	const [scrolled, setScrolled] = React.useState(false);

	const onScroll = React.useCallback(() => {
		setScrolled(window.scrollY > threshold);
	}, [threshold]);

	React.useEffect(() => {
		window.addEventListener('scroll', onScroll);
		return () => window.removeEventListener('scroll', onScroll);
	}, [onScroll]);

	React.useEffect(() => {
		onScroll();
	}, [onScroll]);

	return scrolled;
}
