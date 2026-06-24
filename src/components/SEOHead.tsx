import { Helmet } from "react-helmet-async";
import {
  absoluteUrl,
  buildBreadcrumbSchema,
  buildFaqSchema,
  buildHowToSchema,
  buildItemListSchema,
  buildOrganizationSchema,
  buildWebAppSchema,
  buildWebsiteSchema,
  type PageSeo,
} from "@/lib/seo-config";
import { SITE_NAME, SITE_URL } from "@/lib/site";

interface SEOHeadProps {
  page: PageSeo;
  toolName?: string;
  breadcrumbs?: { name: string; path: string }[];
  includeWebsiteSchema?: boolean;
  includeItemList?: boolean;
  includeOrganization?: boolean;
}

export default function SEOHead({
  page,
  toolName,
  breadcrumbs,
  includeWebsiteSchema = false,
  includeItemList = false,
  includeOrganization = false,
}: SEOHeadProps) {
  const url = absoluteUrl(page.path);
  const ogImage = `${SITE_URL}/og-image.jpg`;

  const schemas: object[] = [buildWebAppSchema(page, toolName)];
  if (page.faqs?.length) schemas.push(buildFaqSchema(page.faqs));
  if (page.howToSteps?.length) {
    schemas.push(
      buildHowToSchema(
        toolName ? `How to ${toolName}` : page.title,
        page.description,
        page.howToSteps,
        url
      )
    );
  }
  if (breadcrumbs?.length) schemas.push(buildBreadcrumbSchema(breadcrumbs));
  if (includeWebsiteSchema) schemas.push(buildWebsiteSchema());
  if (includeItemList) schemas.push(buildItemListSchema());
  if (includeOrganization) schemas.push(buildOrganizationSchema());

  return (
    <Helmet>
      <html lang="en" />
      <title>{page.title}</title>
      <meta name="description" content={page.description} />
      <meta name="keywords" content={page.keywords} />
      <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
      <link rel="canonical" href={url} />

      <meta property="og:type" content="website" />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={page.title} />
      <meta property="og:description" content={page.description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_US" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={page.title} />
      <meta name="twitter:description" content={page.description} />
      <meta name="twitter:image" content={ogImage} />

      <meta name="author" content={SITE_NAME} />
      <meta name="theme-color" content="#4f46e5" />
      <meta name="application-name" content={SITE_NAME} />

      <link rel="alternate" type="text/plain" href={`${SITE_URL}/llms.txt`} title="LLM site map" />

      {schemas.map((schema, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
}
