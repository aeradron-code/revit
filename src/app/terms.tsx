import {
  LegalDocumentScreen,
  type LegalSection,
} from "@/features/legal/legal-document-screen";

const sections: LegalSection[] = [
  {
    title: "Using Revit",
    paragraphs: [
      "These Terms apply to Revit, operated by Aeradron in India. By creating an account or using Revit, you agree to these Terms and the Privacy Policy. If you do not agree, do not create an account or use the service.",
      "You are responsible for keeping your account credentials secure and for activity through your account. Keep your profile information accurate and contact Aeradron if you believe someone has accessed your account without permission.",
    ],
  },
  {
    title: "Your content",
    paragraphs: [
      "You retain ownership of content you submit. You give Aeradron a non-exclusive, worldwide, royalty-free license to host, store, reproduce, and display that content as needed to operate and provide Revit to you and other users.",
      "Only submit content and images you have the right to use. You are responsible for your content and for ensuring it is accurate and lawful.",
    ],
  },
  {
    title: "Acceptable use",
    paragraphs: [
      "Do not use Revit to post unlawful, threatening, harassing, hateful, deceptive, impersonating, spam, or otherwise abusive material. Do not violate another person’s privacy or intellectual-property rights, interfere with the service, or attempt to access another account without permission.",
      "You can report a profile, post, comment, Find, forum, or Pick using its report option. You can block an account from its profile. Reports are reviewed by a Revit administrator. A report marked “Reviewed” means an administrator reviewed it; that status does not automatically remove content or disable an account.",
    ],
  },
  {
    title: "Account deletion",
    paragraphs: [
      "You can request permanent account deletion in Settings. This removes your account and associated content and uploaded files from Revit’s active systems, subject to the retention described in the Privacy Policy.",
      "Find catalog entries you contributed may remain without your creator details or image. Reports you submitted are deleted with your account. Reports submitted by others about your account or content may remain with report snapshots for review.",
    ],
  },
  {
    title: "Revit content and availability",
    paragraphs: [
      "Ratings and Find listings reflect user contributions and are not guarantees or endorsements by Aeradron. Revit may change or discontinue features. Aeradron may restrict or terminate access where needed to address violations, protect users, or comply with law.",
      "Revit is provided on an “as available” basis. To the extent permitted by applicable law, Aeradron disclaims warranties that cannot be guaranteed for an online service. Nothing in these Terms limits rights or remedies that cannot legally be limited.",
    ],
  },
  {
    title: "Changes and governing law",
    paragraphs: [
      "Aeradron may update these Terms as Revit changes. Updated Terms will be posted here with a new effective date. Continued use after the effective date means you accept the updated Terms, where permitted by law.",
      "These Terms are governed by the laws of India, subject to any mandatory consumer-protection rights that apply to you.",
    ],
  },
  {
    title: "Contact",
    paragraphs: [
      "Questions about these Terms? Contact Aeradron at aeradron@gmail.com or +91 7899270142.",
    ],
  },
];

export default function TermsScreen() {
  return (
    <LegalDocumentScreen
      intro="Please read these Terms before using Revit. They explain the basic rules for accounts, user content, and safety features."
      sections={sections}
      title="Terms and Conditions"
    />
  );
}
