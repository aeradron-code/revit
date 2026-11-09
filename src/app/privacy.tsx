import {
  LegalDocumentScreen,
  type LegalSection,
} from "@/features/legal/legal-document-screen";

const sections: LegalSection[] = [
  {
    title: "Information Revit handles",
    paragraphs: [
      "When you create an account, Revit processes your email address and authentication information. If you choose Google sign-in, Google and Supabase process the information needed to authenticate you.",
      "Revit stores profile details you provide, including your display name, username, and bio. It also stores content and activity you create or choose, such as reviews and posts, images, comments and replies, ratings, follows, forum details and posts, Picks, and Find listings. Find listings may include place details or addresses that you enter.",
      "Revit also stores safety and activity information: reports and their summaries, users you block, and activity notifications and their read state. If you contact support, Aeradron receives the information you include in that message.",
      "The app lets you select photos from your device’s photo library for uploads. The current app does not request camera, microphone, or precise location permission.",
    ],
  },
  {
    title: "How information is used",
    paragraphs: [
      "Aeradron uses this information to create and secure accounts, show profiles and Revit content, provide social features and activity notifications, operate Find and forum features, respond to support requests, and receive and review safety reports.",
      "Revit currently does not include advertising or analytics SDKs in its app code. This may change only if Aeradron updates this policy and any required disclosures.",
    ],
  },
  {
    title: "Who can see information",
    paragraphs: [
      "Profiles, posts, comments, ratings, forums, Picks, and Find listings are available to signed-in Revit users as part of the service. Do not post information you want to keep private.",
      "Images attached to shared Find listings use public image URLs, so anyone with an image URL may be able to view that image. Post and forum images use access-controlled storage.",
      "Reports are available to the person who submitted them and to Revit administrators who review reports. A report includes a snapshot of the reported account or content so it can still be reviewed if that account or content is removed.",
      "Blocking limits the blocked accounts’ access to each other’s posts, comments, and Picks and prevents certain interactions. Blocking does not erase content or reports.",
    ],
  },
  {
    title: "Service providers",
    paragraphs: [
      "Supabase provides Revit’s authentication, database, file storage, and server functions. Google acts as an identity provider when you choose Google sign-in. These providers process information as needed to provide their services and are subject to their own privacy terms.",
      "Aeradron does not sell personal information through Revit. Information may be disclosed when needed to operate the service, protect users, comply with law, or respond to a valid legal request.",
    ],
  },
  {
    title: "Retention and account deletion",
    paragraphs: [
      "Aeradron keeps account information and associated content while your account is active and as needed to operate Revit, protect users, resolve disputes, and meet legal obligations. You can request account deletion in Settings. The deletion process removes your account, account-associated posts and activity, and uploaded files from Revit’s active systems.",
      "Find catalog entries you created may remain as shared listings. When your account is deleted, the creator association and image are removed from those entries.",
      "Reports you submitted are deleted with your account. Reports submitted by other people about your account or content may remain with their report snapshots so those reports can be reviewed. Hosting-provider backups and operational logs may retain residual copies for a limited period under the provider’s retention practices.",
    ],
  },
  {
    title: "Your choices and requests",
    paragraphs: [
      "You can edit profile details in Settings, delete your account from Settings, and contact Aeradron to ask about your information or raise a privacy concern. Some information in reports from other users may be retained as described above.",
      "To make a privacy request, email aeradron@gmail.com. Please do not send your password or sign-in codes.",
    ],
  },
  {
    title: "Security and changes",
    paragraphs: [
      "Aeradron uses access controls and service-provider security features to protect information. No internet service can guarantee that information is completely secure.",
      "Aeradron may update this policy when Revit’s data practices change. The latest version and its effective date will be available in the app.",
    ],
  },
  {
    title: "Contact",
    paragraphs: [
      "Revit is operated by Aeradron in India. For privacy questions or requests, contact aeradron@gmail.com or call +91 7899270142.",
    ],
  },
];

export default function PrivacyScreen() {
  return (
    <LegalDocumentScreen
      intro="This Privacy Policy explains how Aeradron handles information when you use Revit, a social ratings and discovery app."
      sections={sections}
      title="Privacy Policy"
    />
  );
}
