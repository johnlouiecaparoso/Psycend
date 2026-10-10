import type { Metadata } from "next";
import { LegalDocumentView } from "@/components/legal/legal-document-view";
import { APP_NAME } from "@/lib/constants";
import { termsDocument } from "@/lib/legal-content";

export const metadata: Metadata = {
  title: `User Agreement | ${APP_NAME}`,
  description: termsDocument.summary
};

export default function TermsPage() {
  return <LegalDocumentView document={termsDocument} />;
}
