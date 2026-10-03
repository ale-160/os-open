import React from "react";
import { getStructuredData } from "@/config/structuredData";

export function StructuredDataScript({ lang = "en" }: { lang?: string }) {
  const data = getStructuredData(lang);

  return (
    <>
      {data.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
    </>
  );
}
