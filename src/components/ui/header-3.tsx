'use client';
import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MenuToggleIcon } from '@/components/ui/menu-toggle-icon';
import { createPortal } from 'react-dom';
import {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import { LucideIcon } from 'lucide-react';
import {
	Code as CodeIcon,
	Globe as GlobeIcon,
	Layers as LayersIcon,
	UserPlus as UserPlusIcon,
	Users,
	Star,
	FileText,
	Shield,
	RotateCcw,
	Handshake,
	Leaf,
	HelpCircle,
	BarChart,
	Plug as PlugIcon,
	Truck,
} from 'lucide-react';

type LinkItem = {
	title: string;
	href: string;
	icon: LucideIcon;
	description?: string;
};

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
					<NavigationMenu className="hidden md:flex">
						<NavigationMenuList>
							<NavigationMenuItem>
								<NavigationMenuTrigger className="bg-transparent">Product</NavigationMenuTrigger>
								<NavigationMenuContent className="bg-background p-1 pr-1.5">
									<ul className="bg-popover grid w-lg grid-cols-2 gap-2 rounded-md border p-2 shadow">
										{productLinks.map((item, i) => (
											<li key={i}>
												<ListItem {...item} />
											</li>
										))}
									</ul>
									<div className="p-2">
										<p className="text-muted-foreground text-sm">
											Interested?{' '}
											<a href="#contact" className="text-foreground font-medium hover:underline">
												Schedule a demo
											</a>
										</p>
									</div>
								</NavigationMenuContent>
							</NavigationMenuItem>
							<NavigationMenuItem>
								<NavigationMenuTrigger className="bg-transparent">Company</NavigationMenuTrigger>
								<NavigationMenuContent className="bg-background p-1 pr-1.5 pb-1.5">
									<div className="grid w-lg grid-cols-2 gap-2">
										<ul className="bg-popover space-y-2 rounded-md border p-2 shadow">
											{companyLinks.map((item, i) => (
												<li key={i}>
													<ListItem {...item} />
												</li>
											))}
										</ul>
										<ul className="space-y-2 p-3">
											{companyLinks2.map((item, i) => (
												<li key={i}>
													<NavigationMenuLink
														href={item.href}
														className="flex p-2 hover:bg-accent flex-row rounded-md items-center gap-x-2"
													>
														<item.icon className="text-foreground size-4" />
														<span className="font-medium">{item.title}</span>
													</NavigationMenuLink>
												</li>
											))}
										</ul>
									</div>
								</NavigationMenuContent>
							</NavigationMenuItem>
							<NavigationMenuLink className="px-4" asChild>
								<a href="#pricing" className="hover:bg-accent rounded-md p-2">
									Pricing
								</a>
							</NavigationMenuLink>
						</NavigationMenuList>
					</NavigationMenu>
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
				<NavigationMenu className="max-w-full">
					<div className="flex w-full flex-col gap-y-2">
						<span className="text-sm font-semibold">Product</span>
						{productLinks.map((link) => (
							<ListItem key={link.title} {...link} />
						))}
						<span className="text-sm font-semibold mt-4">Company</span>
						{companyLinks.map((link) => (
							<ListItem key={link.title} {...link} />
						))}
						{companyLinks2.map((link) => (
							<ListItem key={link.title} {...link} />
						))}
					</div>
				</NavigationMenu>
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

function ListItem({
	title,
	description,
	icon: Icon,
	className,
	href,
	...props
}: React.ComponentProps<typeof NavigationMenuLink> & LinkItem) {
	return (
		<NavigationMenuLink className={cn('w-full flex flex-row gap-x-2 data-[active=true]:focus:bg-accent data-[active=true]:hover:bg-accent data-[active=true]:bg-accent/50 data-[active=true]:text-accent-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground rounded-sm p-2', className)} {...props} asChild>
			<a href={href}>
				<div className="bg-background/40 flex aspect-square size-12 items-center justify-center rounded-md border shadow-sm">
					<Icon className="text-foreground size-5" />
				</div>
				<div className="flex flex-col items-start justify-center">
					<span className="font-medium">{title}</span>
					<span className="text-muted-foreground text-xs">{description}</span>
				</div>
			</a>
		</NavigationMenuLink>
	);
}

const productLinks: LinkItem[] = [
	{
		title: 'Real-time Tracking',
		href: '#features',
		description: 'Monitor your fleet in real-time',
		icon: GlobeIcon,
	},
	{
		title: 'Fleet Analytics',
		href: '/analytics',
		description: 'Comprehensive fleet insights',
		icon: BarChart,
	},
	{
		title: 'Geofencing',
		href: '/geofences',
		description: 'Set up location-based alerts',
		icon: LayersIcon,
	},
	{
		title: 'Trip Management',
		href: '/trips',
		description: 'Track routes and trip history',
		icon: PlugIcon,
	},
	{
		title: 'Driver Management',
		href: '/driver',
		description: 'Manage drivers and assignments',
		icon: UserPlusIcon,
	},
	{
		title: 'API Access',
		href: '#',
		description: 'Integrate with our API',
		icon: CodeIcon,
	},
];

const companyLinks: LinkItem[] = [
	{
		title: 'About Us',
		href: '#',
		description: 'Learn about our mission',
		icon: Users,
	},
	{
		title: 'Customer Stories',
		href: '#testimonials',
		description: 'Success stories from our clients',
		icon: Star,
	},
	{
		title: 'Partnerships',
		href: '#',
		icon: Handshake,
		description: 'Partner with us',
	},
];

const companyLinks2: LinkItem[] = [
	{
		title: 'Terms of Service',
		href: '#',
		icon: FileText,
	},
	{
		title: 'Privacy Policy',
		href: '#',
		icon: Shield,
	},
	{
		title: 'Support',
		href: '#contact',
		icon: HelpCircle,
	},
	{
		title: 'Blog',
		href: '#',
		icon: Leaf,
	},
];

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
