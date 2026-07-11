import {
  Hero, ProductsSection, ServicesSection, TestimonialsSection, FaqSection,
  type Product, type Service, type Testimonial, type Faq,
} from "@/components/site/sections";
import { ContactSection } from "@/components/site/contact";
import { publicGet } from "@/lib/api";
import { getSiteSettings, companyOrDefault } from "@/lib/site-settings";

// Everything on this page is driven by the admin panel via /settings/public and the catalog APIs.
export const revalidate = 60;

export default async function HomePage() {
  const [settings, products, services, testimonials, faq] = await Promise.all([
    getSiteSettings(),
    publicGet<{ items: Product[] }>("/products?limit=13&sortBy=sortOrder&sortDir=asc", { items: [] }),
    publicGet<{ items: Service[] }>("/services?limit=8&sortBy=sortOrder&sortDir=asc", { items: [] }),
    publicGet<{ items: Testimonial[] }>("/testimonials?limit=3&sortBy=sortOrder&sortDir=asc", { items: [] }),
    publicGet<{ items: Faq[] }>("/faq?limit=6&sortBy=sortOrder&sortDir=asc", { items: [] }),
  ]);
  const company = companyOrDefault(settings.company);

  return (
    <>
      <Hero company={company} />
      <ProductsSection products={products.items} />
      <ServicesSection services={services.items} />
      <TestimonialsSection items={testimonials.items} />
      <FaqSection items={faq.items} />
      <ContactSection email={company.email} phone={company.phone} communication={settings.communication} />
    </>
  );
}
