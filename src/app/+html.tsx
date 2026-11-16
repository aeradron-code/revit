import {
  ScrollViewStyleReset,
  useServerDocumentContext,
} from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function RootHtml({ children }: PropsWithChildren) {
  const { htmlAttributes, bodyAttributes, headNodes, bodyNodes } =
    useServerDocumentContext();

  return (
    <html lang="en" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <title>Revit — Good finds. Trusted opinions.</title>
        <meta
          name="description"
          content="Discover finds, share ratings and reviews, and ask your circle for advice."
        />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Revit" />
        <meta property="og:title" content="Revit — Good finds. Trusted opinions." />
        <meta
          property="og:description"
          content="Discover finds, share ratings and reviews, and ask your circle for advice."
        />
        <meta property="og:image" content="https://revitapp.in/revit-link-preview.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Revit — Good finds. Trusted opinions." />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Revit — Good finds. Trusted opinions." />
        <meta
          name="twitter:description"
          content="Discover finds, share ratings and reviews, and ask your circle for advice."
        />
        <meta name="twitter:image" content="https://revitapp.in/revit-link-preview.png" />
        <ScrollViewStyleReset />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
