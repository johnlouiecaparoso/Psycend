import type { Metadata } from "next";
import { LegalDocumentView } from "@/components/legal/legal-document-view";
import { APP_NAME } from "@/lib/constants";
import { privacyDocument } from "@/lib/legal-content";

export const metadata: Metadata = {
  title: `Privacy Policy | ${APP_NAME}`,
  description: privacyDocument.summary
};

export default function PrivacyPolicyPage() {
  return <LegalDocumentView document={privacyDocument} />;
}
