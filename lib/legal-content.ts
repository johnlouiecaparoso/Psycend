import { APP_NAME } from "@/lib/constants";

/**
 * Bump this when the policy text changes materially. Accounts that accepted an
 * older version will be asked to review the updated documents again.
 */
export const POLICY_VERSION = "2026-08-19";

export const POLICY_LAST_UPDATED = "August 19, 2026";

/** Fill in a monitored mailbox before launch. */
export const CONTACT_EMAIL = "support@psycend.app";

export type LegalSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type LegalDocument = {
  slug: string;
  title: string;
  summary: string;
  sections: LegalSection[];
};

export const aboutDocument: LegalDocument = {
  slug: "/about",
  title: `About ${APP_NAME}`,
  summary:
    "A focused review platform built for students preparing for the Philippine psychology licensure examination.",
  sections: [
    {
      heading: "Why we built it",
      paragraphs: [
        `Board review usually means a stack of photocopied handouts and no clear sense of what still needs work. ${APP_NAME} turns that same material into structured practice: timed mock exams, short quizzes, flashcards, and reviewer PDFs drawn from one shared question bank.`,
        "The point is not to add more content. It is to make the content you already have tell you where you stand, so study time goes to the topics that are actually costing you marks."
      ]
    },
    {
      heading: "What you get",
      bullets: [
        "Timed mock exams that mirror board conditions, with an autosaving draft so a lost connection does not cost you an attempt.",
        "Quick quizzes filtered by subject, chapter, and topic when you only have a few minutes.",
        "Flashcards with a weak-topics filter, built from the same verified question bank.",
        "Per-topic analytics: readiness score, subject performance, weak topic detection, and chapter coverage.",
        "Reviewer PDFs and downloadable offline study packs for reviewing without a connection.",
        "An AI study helper for explaining concepts you are stuck on."
      ]
    },
    {
      heading: "How questions get here",
      paragraphs: [
        "Administrators import questions through a strict CSV workflow that validates every row, normalises answer keys, and logs anything it rejects before saving. Questions carry a subject, chapter, topic, difficulty, and an explanation, which is what makes per-topic analytics possible.",
        "Content is prepared for review practice. It is not affiliated with, endorsed by, or sourced from the Professional Regulation Commission."
      ]
    },
    {
      heading: "Study on any device",
      paragraphs: [
        `${APP_NAME} is mobile-first and installable as an app on your phone. Downloaded study packs, flashcard decks, and in-progress exam drafts stay on your device, so you can keep reviewing offline and sync your results when you are back online.`
      ]
    },
    {
      heading: "Get in touch",
      paragraphs: [
        `Questions, corrections to a question item, or account problems: email ${CONTACT_EMAIL}. Reports of a wrong answer key are genuinely welcome — they improve the bank for everyone.`
      ]
    }
  ]
};

export const privacyDocument: LegalDocument = {
  slug: "/privacy",
  title: "Privacy Policy",
  summary: `How ${APP_NAME} collects, uses, stores, and protects your information.`,
  sections: [
    {
      heading: "Information we collect",
      paragraphs: ["We collect only what the platform needs to run your review account."],
      bullets: [
        "Account details: your full name, email address, and role. Your password is handled by our authentication provider and is stored only as a cryptographic hash — we never see or store it in readable form.",
        "Study activity: exam and quiz attempts, the answers you select, scores, timestamps, and the weak topics derived from them.",
        "Preferences: your theme, notification settings, and chosen study technique.",
        "Study tools data: pomodoro sessions and any study tasks you create.",
        "Technical data: standard server logs, and the session cookies required to keep you signed in."
      ]
    },
    {
      heading: "How we use it",
      bullets: [
        "To authenticate you and keep your session active.",
        "To score your attempts and generate your analytics — readiness, subject performance, weak topics, and chapter coverage.",
        "To recommend what to review next based on your weakest topics.",
        "To remember your preferences across devices.",
        "To keep the service secure, diagnose faults, and improve question quality."
      ]
    },
    {
      heading: "Stored on your device",
      paragraphs: [
        "Some data never leaves your device. In-progress exam drafts, downloaded offline study packs and flashcard decks, your cached theme, and offline results are kept in your browser's local storage and IndexedDB so the platform works without a connection.",
        "Clearing your browser data removes these. An exam draft that has not been submitted will be lost."
      ]
    },
    {
      heading: "Third-party services",
      paragraphs: [
        "We rely on a small number of processors, and we do not sell your personal information to anyone."
      ],
      bullets: [
        "Supabase — hosts our database and handles authentication. Your account and study records are stored there.",
        "Google Gemini — powers the AI study helper. When you send a question to the helper, the text of that question and the selected subject are transmitted to Google for processing. Do not enter personal, sensitive, or confidential information into the AI helper.",
        "Our hosting provider, which processes standard request logs."
      ]
    },
    {
      heading: "Access control",
      paragraphs: [
        "Your study records are yours. Administrators can manage the question bank, reviewer library, and imports, and can see aggregate platform activity, but routine access to an individual student's attempt history is not part of normal operation. Access is enforced both in the application and by row-level security rules in the database."
      ]
    },
    {
      heading: "Data retention and deleting your account",
      paragraphs: [
        "We keep your account and study history for as long as your account is active, because your analytics depend on the full history.",
        "You can delete your account yourself at any time from Settings. Deletion is immediate and permanent: your profile, every exam and quiz attempt, your answers, your analytics, and your study sessions are removed, and none of it can be restored. Anything cached on your own device is cleared when you sign out.",
        "Administrator and instructor accounts own imported questions and reviewer files, so they are closed manually — contact us and that content will be reassigned first. Where the law requires us to retain a specific record, we keep only that record and nothing further."
      ]
    },
    {
      heading: "Your rights",
      paragraphs: [
        `Under the Philippine Data Privacy Act of 2012 (Republic Act No. 10173), you have the right to be informed, to access your data, to correct inaccurate data, to object to processing, to erasure or blocking, to data portability, and to damages for a violation of your rights.`,
        `To exercise any of these, email ${CONTACT_EMAIL}. You may also lodge a complaint with the National Privacy Commission.`
      ]
    },
    {
      heading: "Security",
      paragraphs: [
        "Data is transmitted over encrypted connections and access is restricted by role and by database-level policies. No system is perfectly secure, so please use a strong, unique password and tell us promptly if you suspect your account has been accessed by someone else."
      ]
    },
    {
      heading: "Children",
      paragraphs: [
        `${APP_NAME} is intended for university-level students and graduates preparing for a professional licensure examination. It is not directed at children under 13, and we do not knowingly collect their information.`
      ]
    },
    {
      heading: "Changes to this policy",
      paragraphs: [
        "If we change this policy in a way that materially affects you, we will update the date below and ask you to review the revised version the next time you sign in."
      ]
    }
  ]
};

export const termsDocument: LegalDocument = {
  slug: "/terms",
  title: "User Agreement",
  summary: `The terms you agree to when you use ${APP_NAME}.`,
  sections: [
    {
      heading: "Acceptance",
      paragraphs: [
        `By creating an account or using ${APP_NAME}, you agree to this User Agreement and to our Privacy Policy. If you do not agree, please do not use the platform.`
      ]
    },
    {
      heading: "Your account",
      bullets: [
        "Provide accurate registration details and keep them current.",
        "You are responsible for keeping your password confidential and for activity under your account.",
        "One account per person. Do not share your login or let anyone else review under your account — shared use corrupts the analytics that make the platform useful.",
        "Tell us promptly if you believe your account has been compromised."
      ]
    },
    {
      heading: "Acceptable use",
      paragraphs: ["You agree not to:"],
      bullets: [
        "Copy, export, screenshot in bulk, redistribute, resell, or publish the question bank or reviewer materials.",
        "Use automated tools to scrape, harvest, or bulk-download content.",
        "Attempt to bypass access controls, reach another user's records, or probe the platform's security.",
        "Upload unlawful, infringing, or malicious content.",
        "Interfere with the platform's operation or with another user's access to it."
      ]
    },
    {
      heading: "Intellectual property",
      paragraphs: [
        `The platform, its design, and the compiled question bank and reviewer materials are the property of ${APP_NAME} or its licensors. Your account grants you a personal, non-transferable, non-exclusive licence to use the materials for your own exam preparation only. That licence ends when your account does.`
      ]
    },
    {
      heading: "Study content and no guarantee of results",
      paragraphs: [
        `Review material is prepared for practice and may contain errors, may not reflect the most recent syllabus, and is not a substitute for official references or formal instruction. ${APP_NAME} is not affiliated with, endorsed by, or connected to the Professional Regulation Commission or the Board of Psychology.`,
        "Readiness scores, weak-topic detection, and analytics are study aids derived from your own practice results. They are not predictions, and nothing here guarantees that you will pass the licensure examination."
      ]
    },
    {
      heading: "AI study helper",
      paragraphs: [
        "The AI helper produces automatically generated explanations, which can be incomplete or wrong. Verify anything important against your references before relying on it. Do not enter personal, sensitive, or confidential information into the helper — see the Privacy Policy for how those queries are processed."
      ]
    },
    {
      heading: "Availability",
      paragraphs: [
        "We aim to keep the platform available and accurate, but we provide it on an \"as is\" and \"as available\" basis. Features may change, and access may be interrupted for maintenance, updates, or reasons outside our control. Keep your own backup of anything you cannot afford to lose."
      ]
    },
    {
      heading: "Suspension and termination",
      paragraphs: [
        "We may suspend or close an account that breaches this agreement, particularly where the question bank is being redistributed or access controls are being circumvented.",
        "You may delete your own account at any time from Settings. Deletion is immediate and permanent, and your study history cannot be recovered afterwards."
      ]
    },
    {
      heading: "Limitation of liability",
      paragraphs: [
        "To the fullest extent permitted by Philippine law, we are not liable for indirect, incidental, or consequential losses arising from your use of the platform, including examination outcomes. Nothing in this agreement limits liability that cannot lawfully be limited."
      ]
    },
    {
      heading: "Governing law",
      paragraphs: [
        "This agreement is governed by the laws of the Republic of the Philippines, and the courts of the Philippines have jurisdiction over any dispute arising from it."
      ]
    },
    {
      heading: "Changes to these terms",
      paragraphs: [
        `We may update this agreement. When we make a material change we will ask you to review and accept the new version the next time you sign in. Continuing to use ${APP_NAME} after that means you accept the revised terms.`
      ]
    },
    {
      heading: "Contact",
      paragraphs: [`Questions about this agreement: ${CONTACT_EMAIL}.`]
    }
  ]
};

export const legalDocuments = [aboutDocument, privacyDocument, termsDocument];
