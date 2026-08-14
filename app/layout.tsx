import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title:
    "Royal Partner Agent Performance",

  description:
    "Royal Partner Agent Activity, Production, Performance and Development System",
};

const themeScript = `
(function () {
  try {
    var saved = localStorage.getItem("agent-dev-theme");
    var theme =
      saved === "morning" || saved === "night"
        ? saved
        : "night";

    document.documentElement.setAttribute(
      "data-rp-theme",
      theme
    );
  } catch (e) {
    document.documentElement.setAttribute(
      "data-rp-theme",
      "night"
    );
  }
})();
`;

export default function RootLayout({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <html
      lang="th"
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              themeScript,
          }}
        />
      </head>

      <body>
        {children}
      </body>
    </html>
  );
}
