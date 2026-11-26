import {
  ScrollViewStyleReset,
  useServerDocumentContext,
} from "expo-router/html";
import type { PropsWithChildren } from "react";

const pageMetadata = {
  "/": {
    title: "Revit — Good finds. Trusted opinions.",
    description:
      "Discover finds, share ratings and reviews, and ask your circle for advice.",
  },
  "/support": {
    title: "Revit Support | Account and App Help",
    description:
      "Get help with your Revit account, privacy, or app issues, including sign-in guidance and support contact details.",
  },
  "/privacy": {
    title: "Privacy Policy | Revit",
    description:
      "Learn how Revit handles account details, profiles, reviews, images, reports, and other information when you use the app.",
  },
  "/terms": {
    title: "Terms and Conditions | Revit",
    description:
      "Read Revit’s terms for accounts, user content, acceptable use, account deletion, and service availability.",
  },
} as const;

export default function RootHtml({
  children,
  pathname,
}: PropsWithChildren<{ pathname?: string }>) {
  const { htmlAttributes, bodyAttributes, headNodes, bodyNodes } =
    useServerDocumentContext();
  const metadata = pageMetadata[pathname as keyof typeof pageMetadata];
  const isIndexablePage = metadata !== undefined;
  const isQaBuild = process.env.REVIT_QA_NO_INDEX === "true";
  const canonicalUrl = isIndexablePage
    ? `https://revitapp.in${pathname === "/" ? "/" : pathname}`
    : null;
  const title = metadata?.title ?? "Revit — Good finds. Trusted opinions.";
  const description =
    metadata?.description ??
    "Discover finds, share ratings and reviews, and ask your circle for advice.";

  return (
    <html lang="en" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta
          name="robots"
          content={
            isQaBuild || !isIndexablePage ? "noindex, follow" : "index, follow"
          }
        />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Revit" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        {canonicalUrl ? (
          <>
            <link rel="canonical" href={canonicalUrl} />
            <meta property="og:url" content={canonicalUrl} />
          </>
        ) : null}
        <meta
          property="og:image"
          content="https://revitapp.in/revit-link-preview.png"
        />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content={title} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta
          name="twitter:image"
          content="https://revitapp.in/revit-link-preview.png"
        />
        <ScrollViewStyleReset />
        <script src="/theme-init.js" />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {pathname === "/" ? (
          <div
            id="revit-session-bootstrap"
            className="session-bootstrap-overlay"
            hidden
            role="status"
            aria-live="polite"
          >
            <span className="session-bootstrap-spinner" aria-hidden="true" />
            <span>Restoring your session…</span>
          </div>
        ) : null}
        {bodyNodes}
      </body>
    </html>
  );
}
