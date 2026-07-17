import {
  CalendarDays,
  Images,
  LayoutDashboard,
  Settings,
  Share2,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const navItems: NavItem[] = [
  { label: "Overview", href: "/", icon: LayoutDashboard },
  { label: "Clients", href: "/clients", icon: Users },
  { label: "Content", href: "/content", icon: Images },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Shared previews", href: "/previews", icon: Share2 },
  { label: "Settings", href: "/settings", icon: Settings },
];

/** Titles for routes that live outside the sidebar navigation. */
const extraTitles: Record<string, string> = {
  "/preview": "Profile preview",
};

export function getPageTitle(pathname: string): string {
  if (pathname === "/") return "Overview";
  const extra = Object.entries(extraTitles).find(([href]) => pathname.startsWith(href));
  if (extra) return extra[1];
  const match = navItems.find(
    (item) => item.href !== "/" && pathname.startsWith(item.href),
  );
  return match?.label ?? "Overview";
}
