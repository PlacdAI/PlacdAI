import { createFileRoute, Link } from "@tanstack/react-router";
import logoImg from "@/assets/1785916564-trimmy-testingplacdLOGO-removebg-preview.png";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — PlacdAI" },
      {
        name: "description",
        content: "The terms that govern your use of PlacdAI.",
      },
    ],
  }),
  component: TermsOfServicePage,
});

// ---------------------------------------------------------------------
// Nothing left in [[brackets]] — ready to publish.
// This is a solid working draft, not legal advice.
// ---------------------------------------------------------------------
const LEGAL_NAME = "Syed Aayan Wasti";
const CONTACT_EMAIL = "placdaisupport@gmail.com";
const PROVINCE = "Ontario, Canada";
const EFFECTIVE_DATE = "September 2, 2026";

// Static header for standalone pages (Privacy/Terms) — mirrors the
// landing page's logo, wordmark, and cream palette (index.tsx), but
// without the scroll/hamburger behavior that page uses, since this is
// a simple static page, not a marketing page with in-page anchors.
function LegalPageNav() {
  return (
    <nav className="border-b border-[#E8E0D8] bg-[#FAF8F5]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-6 sm:px-10">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={logoImg} alt="" className="h-[34px] object-contain" />
          <span
            className="text-2xl font-medium tracking-tight"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            <span style={{ color: "#1E1E1E" }}>Placd</span>
            <span style={{ color: "#7C9080" }}>AI</span>
          </span>
        </Link>
        <Link
          to="/login"
          className="text-[13.5px] font-medium text-[#7A6B5E] transition-colors hover:text-[#1C1C1C]"
        >
          Log In
        </Link>
      </div>
    </nav>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2
        className="mb-3 text-[19px] font-semibold text-[#1C1C1C]"
        style={{ fontFamily: "'Manrope', sans-serif" }}
      >
        {title}
      </h2>
      <div className="space-y-3 text-[14px] leading-relaxed text-[#6B5E52]">
        {children}
      </div>
    </section>
  );
}

function TermsOfServicePage() {
  return (
    <div
      className="flex min-h-[100dvh] flex-col bg-[#FAF8F5]"
      style={{ fontFamily: "'Manrope', sans-serif" }}
    >
      <LegalPageNav />

      <main className="mx-auto w-full max-w-3xl px-6 py-12 sm:px-8">
        <h1 className="mb-2 text-[30px] font-bold tracking-tight text-[#1C1C1C]">
          Terms of Service
        </h1>
        <p className="mb-10 text-[13px] text-[#6B5E52]">
          Effective date: {EFFECTIVE_DATE}
        </p>

        <Section title="1. Acceptance of Terms">
          <p>
            These Terms of Service ("Terms") are a legal agreement between
            you and {LEGAL_NAME} ("PlacdAI," "we," "us," or "our") governing
            your access to and use of the PlacdAI website and application
            (the "Service"). By using the Service, you agree to these Terms.
            If you don't agree, don't use the Service.
          </p>
        </Section>

        <Section title="2. Eligibility">
          <p>
            PlacdAI is open to all users, with no minimum age requirement set
            by us. Note that signing in with Google is subject to Google's
            own account eligibility requirements, which are outside our
            control. Parents and guardians are responsible for supervising
            use of the Service by anyone in their care.
          </p>
        </Section>

        <Section title="3. The Service">
          <p>
            PlacdAI lets you upload a photo of a room and generates an
            AI-redesigned version of it, along with suggestions for real,
            purchasable products that match the redesign. Some features
            (e.g. saving a gallery of your redesigns) require a free account,
            created by signing in with Google; you can browse and try core
            parts of the Service as a guest without an account.
          </p>
        </Section>

        <Section title="4. Credits and Payment">
          <p>
            Generating a room redesign consumes "credits" from your account
            balance. New accounts start with a small number of free credits;
            additional credits are purchased in packs via Stripe, our
            payment processor. All purchases are processed in the currency
            and at the prices displayed at checkout, which may change over
            time.
          </p>
          <p>
            <strong className="text-[#1C1C1C]">
              No automatic refunds for failed or unsatisfactory generations.
            </strong>{" "}
            If a generation fails, produces an error, or otherwise doesn't
            work as expected, credits are not automatically refunded. You
            must contact us at {CONTACT_EMAIL} to report the issue. We will
            investigate and, at our sole discretion, decide whether a credit
            or refund is warranted. We are not responsible for credits
            consumed by errors, failed generations, or unsatisfactory
            results that are never reported to us.
          </p>
          <p>
            <strong className="text-[#1C1C1C]">Credit purchases are non-refundable</strong>,
            except where required by applicable law or where we determine, in
            our sole discretion after investigation, that a refund is
            appropriate.
          </p>
        </Section>

        <Section title="5. Your Content">
          <p>
            You retain ownership of the room photos you upload. By uploading
            a photo, you grant PlacdAI a limited license to use, store,
            process, and display that photo and the redesigns generated from
            it, solely to provide and improve the Service to you. Note that
            uploaded photos and their generated redesigns are automatically
            deleted 72 hours after creation (see our Privacy Policy).
          </p>
          <p>
            You're responsible for what you upload. You confirm that you own
            or have the right to upload each photo, and that doing so doesn't
            infringe anyone else's rights or violate any law.
          </p>
        </Section>

        <Section title="6. AI-Generated Content">
          <p>
            Redesigns are generated using third-party AI models (currently
            Google's Gemini). AI-generated content is inherently
            unpredictable — results may not be fully accurate, realistic, or
            achievable in your actual space, and may occasionally contain
            errors, artifacts, or content you didn't request. The Service is
            a design aid, not a guarantee of how a real renovation would
            look.
          </p>
          <p>
            Subject to Section 5, you may use the redesigns generated for you
            for your own personal purposes. We make no claim over content you
            didn't create or contribute to (e.g. real product images sourced
            from retailers).
          </p>
        </Section>

        <Section title="7. Third-Party Products and Links">
          <p>
            PlacdAI may show real products from third-party retailers (for
            example, Wayfair or Amazon) that visually match your redesign, or
            hand off to third-party tools like Google Visual Search to help
            you find similar items. We don't control these retailers or
            tools, and we aren't responsible for product availability,
            pricing, accuracy of listings, or your transactions with them. We
            may receive a commission if you make a purchase through certain
            links, at no additional cost to you.
          </p>
        </Section>

        <Section title="8. Prohibited Uses">
          <p>You agree not to:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Upload content you don't have the right to use, or that is illegal, infringing, or harmful</li>
            <li>Use the Service to generate content that is unlawful, harassing, or infringes on others' rights</li>
            <li>Attempt to access, reverse-engineer, or interfere with the Service's underlying systems</li>
            <li>Use automated means (bots, scrapers) to access the Service outside of normal use</li>
            <li>Circumvent credit limits, payment requirements, or account restrictions</li>
            <li>Resell or commercially redistribute the Service without our written permission</li>
          </ul>
        </Section>

        <Section title="9. Intellectual Property">
          <p>
            Other than your own uploaded content, the Service — including its
            design, branding, code, and underlying technology — is owned by
            {" "}{LEGAL_NAME} or its licensors and protected by intellectual
            property laws. These Terms don't grant you any rights to
            PlacdAI's trademarks, logos, or brand assets.
          </p>
        </Section>

        <Section title="10. Copyright and Content Claims">
          <p>
            If you believe content on PlacdAI — an uploaded photo, a
            generated redesign, or anything else — infringes your copyright
            or other rights, email us at {CONTACT_EMAIL} with a description
            of the content, its location on the Service, and your contact
            information. We'll investigate and remove content found to be
            infringing.
          </p>
        </Section>

        <Section title="11. Termination">
          <p>
            You may stop using the Service or delete your account at any
            time. We may suspend or terminate your access to the Service,
            with or without notice, if we believe you've violated these
            Terms or used the Service in a way that creates risk or legal
            exposure for us or others. Unused credits are not refunded upon
            termination for a violation of these Terms.
          </p>
        </Section>

        <Section title="12. Disclaimers">
          <p>
            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT
            WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING
            WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
            OR NON-INFRINGEMENT. WE DON'T WARRANT THAT THE SERVICE WILL BE
            UNINTERRUPTED, ERROR-FREE, OR THAT AI-GENERATED RESULTS WILL MEET
            YOUR EXPECTATIONS.
          </p>
        </Section>

        <Section title="13. Limitation of Liability">
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, {LEGAL_NAME} WILL NOT BE
            LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
            PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE SERVICE. OUR TOTAL
            LIABILITY FOR ANY CLAIM RELATING TO THE SERVICE WILL NOT EXCEED
            THE AMOUNT YOU PAID US IN THE 12 MONTHS BEFORE THE CLAIM AROSE.
          </p>
        </Section>

        <Section title="14. Indemnification">
          <p>
            You agree to indemnify and hold {LEGAL_NAME} harmless from any
            claims, damages, or expenses (including reasonable legal fees)
            arising from your violation of these Terms or your misuse of the
            Service.
          </p>
        </Section>

        <Section title="15. Governing Law">
          <p>
            These Terms are governed by the laws of {PROVINCE}, without
            regard to its conflict-of-law principles. Any dispute arising
            from these Terms or the Service will be subject to the exclusive
            jurisdiction of the courts located in {PROVINCE}.
          </p>
        </Section>

        <Section title="16. Changes to These Terms">
          <p>
            We may update these Terms from time to time. If we make material
            changes, we'll update the effective date above and, where
            appropriate, notify you. Continued use of the Service after
            changes take effect means you accept the updated Terms.
          </p>
        </Section>

        <Section title="17. Contact Us">
          <p>
            Questions about these Terms? Email us at{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-[#1C1C1C] underline underline-offset-2"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>

        <p className="mt-12 text-[13px] text-[#6B5E52]">
          See also our{" "}
          <Link to="/privacy" className="text-[#1C1C1C] underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </p>
      </main>
    </div>
  );
}