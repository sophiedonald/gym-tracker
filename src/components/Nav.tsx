"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Dumbbell } from "lucide-react";

const links = [
  { href: "/", label: "Log Workout", Icon: Dumbbell },
  { href: "/plan", label: "Plan Week", Icon: CalendarDays },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex max-w-lg gap-2 p-2">
        {links.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-lg font-semibold ${
                active ? "bg-lime-400 text-black" : "bg-zinc-900 text-zinc-300"
              }`}
            >
              <Icon className="h-5 w-5" /> {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
