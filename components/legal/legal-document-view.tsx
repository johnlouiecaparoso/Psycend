import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { POLICY_LAST_UPDATED, type LegalDocument } from "@/lib/legal-content";
import { cn } from "@/lib/utils";

export function LegalDocumentView({
  document,
  showLastUpdated = true
}: {
  document: LegalDocument;
  showLastUpdated?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="container-shell flex-1 py-8 sm:py-12">
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "outline" }), "mb-6 gap-2")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <header className="rounded-[22px] border bg-card/90 p-6 text-card-foreground shadow-soft backdrop-blur sm:rounded-[32px] sm:p-10">
          <h1 className="break-words text-3xl font-bold tracking-tight sm:text-4xl">{document.title}</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">{document.summary}</p>
          {showLastUpdated ? (
            <p className="mt-4 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Last updated {POLICY_LAST_UPDATED}
            </p>
          ) : null}
        </header>

        <Card className="mt-6">
          <CardContent className="space-y-8 p-5 sm:p-8">
            {document.sections.map((section) => (
              <section key={section.heading} className="space-y-3">
                <h2 className="break-words text-lg font-semibold sm:text-xl">{section.heading}</h2>
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                    {paragraph}
                  </p>
                ))}
                {section.bullets ? (
                  <ul className="space-y-2 pl-5">
                    {section.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="list-disc text-sm leading-relaxed text-muted-foreground marker:text-primary sm:text-base"
                      >
                        {bullet}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </CardContent>
        </Card>
      </main>

      <SiteFooter />
    </div>
  );
}
