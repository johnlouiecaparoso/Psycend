import type { Metadata } from "next";
import { LegalDocumentView } from "@/components/legal/legal-document-view";
import { APP_NAME } from "@/lib/constants";
import { aboutDocument } from "@/lib/legal-content";

export const metadata: Metadata = {
  title: `About | ${APP_NAME}`,
  description: aboutDocument.summary
};

export default function AboutPage() {
  return <LegalDocumentView document={aboutDocument} showLastUpdated={false} />;
}
