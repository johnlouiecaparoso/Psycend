import Link from "next/link";
import { BrainCircuit } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

const footerLinks = [
  { href: "/about", label: "About" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "User Agreement" }
] as const;

export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("border-t bg-card/60 backdrop-blur", className)}>
      <div className="container-shell flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:py-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BrainCircuit className="h-4 w-4 shrink-0 text-primary" />
          <span>
            &copy; {new Date().getFullYear()} {APP_NAME}. Psychology board exam review.
          </span>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {footerLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
