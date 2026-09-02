import { createFileRoute, Link } from "@tanstack/react-router";
import logoImg from "@/assets/1785916564-trimmy-testingplacdLOGO-removebg-preview.png";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — PlacdAI" },
      {
        name: "description",
        content: "How PlacdAI collects, uses, and protects your information.",
      },
    ],
  }),
  component: PrivacyPolicyPage,
});

// ---------------------------------------------------------------------
// Nothing left in [[brackets]] — ready to publish. One thing to
// double-check before launch: Section 5 (Data Retention) now states
// gallery items are auto-deleted after 72 hours, based on the "Gallery
// saves your creations for 72 hours" line on your own login page. If
// signed-in accounts actually keep items longer than guests do, tell
// me and I'll split this into two cases instead of one blanket rule.
// This is a solid working draft, not legal advice — worth a paid
// one-time review once your business entity is settled.
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

function PrivacyPolicyPage() {
  return (
    <div
      className="flex min-h-[100dvh] flex-col bg-[#FAF8F5]"
      style={{ fontFamily: "'Manrope', sans-serif" }}
    >
      <LegalPageNav />

      <main className="mx-auto w-full max-w-3xl px-6 py-12 sm:px-8">
        <h1 className="mb-2 text-[30px] font-bold tracking-tight text-[#1C1C1C]">
          Privacy Policy
        </h1>
        <p className="mb-10 text-[13px] text-[#6B5E52]">
          Effective date: {EFFECTIVE_DATE}
        </p>

        <Section title="1. Introduction">
          <p>
            {LEGAL_NAME} ("PlacdAI," "we," "us," or "our") operates the PlacdAI
            website and application (the "Service"), which lets you upload a
            photo of a room, generate an AI-redesigned version of it, and
            discover real, purchasable products to match the result. This
            Privacy Policy explains what information we collect, how we use
            and share it, and the choices you have.
          </p>
          <p>
            By using the Service, you agree to the collection and use of
            information as described in this Policy. If you don't agree,
            please don't use the Service.
          </p>
        </Section>

        <Section title="2. Information We Collect">
          <p>
            <strong className="text-[#1C1C1C]">Account information.</strong>{" "}
            If you sign in with Google, we receive your name, email address,
            and profile picture from Google. You can also browse most of
            PlacdAI as a guest without creating an account — in that case, we
            don't collect an account profile, but standard technical data
            (below) is still collected.
          </p>
          <p>
            <strong className="text-[#1C1C1C]">
              Room photos and generated designs.
            </strong>{" "}
            When you upload a photo of a room, we store that photo and the
            AI-generated redesign(s) produced from it so you can view them in
            your gallery. See Section 5 for how long these are kept.
          </p>
          <p>
            <strong className="text-[#1C1C1C]">Payment information.</strong>{" "}
            When you purchase credits, payment is processed by Stripe, our
            payment processor. We do not receive or store your full card
            number — Stripe handles that directly. We keep a record of the
            transaction itself (amount, credit pack purchased, date, and a
            payment reference ID) to maintain accurate accounts and prevent
            duplicate charges.
          </p>
          <p>
            <strong className="text-[#1C1C1C]">Usage information.</strong>{" "}
            We keep a record of your generation history (e.g. when a
            redesign succeeded or failed) and your credit balance, so the
            Service functions correctly.
          </p>
          <p>
            <strong className="text-[#1C1C1C]">
              Technical and log information.
            </strong>{" "}
            Like most web services, our infrastructure providers automatically
            log standard technical data — IP address, browser type, device
            information, and timestamps — for security, debugging, and abuse
            prevention.
          </p>
          <p>
            <strong className="text-[#1C1C1C]">Cookies.</strong> We use a
            small number of cookies to keep you signed in and remember your
            session. We don't use advertising or cross-site tracking cookies.
          </p>
        </Section>

        <Section title="3. How We Use Your Information">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>To provide the core Service — generating and storing your room redesigns</li>
            <li>To operate your account, including your credit balance and purchase history</li>
            <li>To process payments and prevent duplicate or fraudulent charges</li>
            <li>To maintain, secure, and troubleshoot the Service</li>
            <li>To communicate with you about your account or transactions</li>
            <li>To comply with legal obligations</li>
          </ul>
          <p>
            We do not sell your personal information, and we do not use your
            room photos to train our own AI models. Your photos are sent to
            Google's Gemini API solely to generate the redesign you
            requested — see Section 4.
          </p>
        </Section>

        <Section title="4. How We Share Your Information">
          <p>
            We don't sell your personal information. We share it only with
            the service providers ("subprocessors") that let us actually run
            PlacdAI, each strictly for the purpose of providing the Service:
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-[#1C1C1C]">Supabase</strong> — hosts
              our database, authentication, and file storage (your account
              data, photos, and generated images).
            </li>
            <li>
              <strong className="text-[#1C1C1C]">Google (Gemini API &amp; Sign-In)</strong>{" "}
              — processes your room photos to generate AI redesigns, and
              provides the "Sign in with Google" option. Google's own privacy
              policy also applies to data it processes on our behalf.
            </li>
            <li>
              <strong className="text-[#1C1C1C]">Stripe</strong> — processes
              credit card payments for credit purchases.
            </li>
            <li>
              <strong className="text-[#1C1C1C]">Netlify</strong> — hosts and
              serves the PlacdAI website and application.
            </li>
          </ul>
          <p>
            If you follow a link to a real product shown in your results
            (e.g. on Wayfair, Amazon, or via a Google Visual Search hand-off),
            you leave PlacdAI and that retailer's own privacy policy applies
            to your activity on their site.
          </p>
          <p>
            We may also disclose information if required by law, or to
            protect the rights, safety, or property of PlacdAI, our users, or
            others.
          </p>
        </Section>

        <Section title="5. Data Retention">
          <p>
            <strong className="text-[#1C1C1C]">Room photos and generated designs</strong>{" "}
            are automatically deleted 72 hours after creation, whether or not
            you're signed in. Save something you want to keep before then —
            once deleted, we can't recover it.
          </p>
          <p>
            <strong className="text-[#1C1C1C]">Account information</strong>{" "}
            (your profile, credit balance, and purchase history) is kept for
            as long as your account is active. You can request deletion of
            your entire account and associated data at any time by contacting
            us (Section 12). We may retain limited transaction records for
            longer where required for accounting, tax, or legal purposes.
          </p>
        </Section>

        <Section title="6. Data Security">
          <p>
            We rely on our infrastructure providers' security practices
            (encryption in transit, access controls, and database-level
            row-level security) to protect your information. No method of
            storage or transmission is completely secure, and we can't
            guarantee absolute security.
          </p>
        </Section>

        <Section title="7. Data Breach Notification">
          <p>
            If a breach of your personal information occurs that poses a
            real risk of significant harm to you, we will notify you and, as
            required under Canadian law, report the breach to the Office of
            the Privacy Commissioner of Canada, as soon as reasonably
            possible after we become aware of it.
          </p>
        </Section>

        <Section title="8. International Data Transfers">
          <p>
            {LEGAL_NAME} is based in {PROVINCE}, but the service providers
            listed in Section 4 may store or process information on servers
            located outside Canada, including in the United States. By using
            the Service, you understand that your information may be
            transferred to, and processed in, jurisdictions with data
            protection laws that may differ from those of your home country.
          </p>
        </Section>

        <Section title="9. Your Privacy Rights">
          <p>
            If you're in Canada, our handling of your personal information is
            governed by the Personal Information Protection and Electronic
            Documents Act (PIPEDA). You have the right to:
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Access the personal information we hold about you</li>
            <li>Correct inaccurate information</li>
            <li>Withdraw consent to our collection, use, or disclosure of your information (which may limit your ability to use the Service)</li>
            <li>Request deletion of your account and associated data</li>
          </ul>
          <p>
            To exercise any of these rights, contact us at {CONTACT_EMAIL}. If
            you're not satisfied with our response, you may file a complaint
            with the Office of the Privacy Commissioner of Canada.
          </p>
          <p>
            If you're located in the European Economic Area, the UK, or a
            U.S. state with its own privacy law (such as California), you may
            have additional or different rights under GDPR, UK GDPR, or
            applicable state law. Contact us and we'll do our best to honor
            those rights even where not separately listed here.
          </p>
        </Section>

        <Section title="10. Children's Privacy">
          <p>
            PlacdAI does not set a minimum age to use the Service. If you are
            a parent or guardian and believe a child in your care has
            provided us with personal information you'd like removed, contact
            us at {CONTACT_EMAIL} and we'll act on that request.
          </p>
        </Section>

        <Section title="11. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. If we make
            material changes, we'll update the effective date above and, where
            appropriate, notify you (e.g. by email or an in-app notice).
            Continued use of the Service after changes take effect means you
            accept the updated Policy.
          </p>
        </Section>

        <Section title="12. Contact Us">
          <p>
            Questions about this Privacy Policy, or want to exercise a
            privacy right described above? Email us at{" "}
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
          <Link to="/terms" className="text-[#1C1C1C] underline underline-offset-2">
            Terms of Service
          </Link>
          .
        </p>
      </main>
    </div>
  );
}