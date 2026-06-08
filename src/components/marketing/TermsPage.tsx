import { LegalLayout } from './LegalLayout'

export function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      description="KinetiMap Terms of Service — understand your rights and obligations when using the KinetiMap platform."
      lastUpdated="June 2026"
    >
      <div className="legal-callout">
        By signing up for or using KinetiMap, you agree to these Terms of Service. Please read them carefully before proceeding.
      </div>

      <h2>1. About KinetiMap</h2>
      <p>
        KinetiMap is a Software-as-a-Service (SaaS) platform designed for physiotherapy clinic management. It is operated by <strong>esemdot</strong>, a company registered in England and Wales. KinetiMap provides tools for patient management, AI-assisted SOAP note generation, appointment scheduling, WhatsApp patient journeys, and clinic analytics.
      </p>

      <h2>2. Acceptance of Terms</h2>
      <p>
        By accessing or using KinetiMap, you confirm that you are at least 18 years old, have authority to bind your clinic or organisation, and agree to be bound by these Terms of Service. If you do not agree, you must not use the service.
      </p>

      <h2>3. Subscription Plans &amp; Billing</h2>
      <p>
        KinetiMap offers the following subscription plans:
      </p>
      <ul>
        <li><strong>Essentials</strong> — £49/month (or discounted multi-month rate)</li>
        <li><strong>Growth</strong> — £89/month (or discounted multi-month rate)</li>
        <li><strong>Scale</strong> — £179/month (or discounted multi-month rate)</li>
        <li><strong>Enterprise</strong> — custom pricing, contact us</li>
      </ul>
      <p>
        Plans are available on monthly, 3-month, 6-month, and yearly billing cycles. Multi-month plans are billed in advance as a single payment. Prices are displayed inclusive of applicable taxes unless otherwise stated.
      </p>

      <h2>4. Free Trial</h2>
      <p>
        All plans include a <strong>14-day free trial</strong>. No credit card is required to start a trial. At the end of the trial period, you may choose to subscribe or your account will be paused. You will not be charged without providing payment details and actively choosing a plan.
      </p>

      <h2>5. AI Booster Packs</h2>
      <p>
        AI SOAP Credit Booster Packs are available as add-ons: 100 credits for £8, 300 credits for £18, or 500 credits for £25. Booster packs are consumed after your monthly plan credits are exhausted and are <strong>non-refundable</strong> once purchased.
      </p>

      <h2>6. Acceptable Use</h2>
      <p>You agree to use KinetiMap only for lawful purposes and in accordance with these Terms. You must not:</p>
      <ul>
        <li>Use the platform to store, transmit, or share any illegal, harmful, or offensive content</li>
        <li>Attempt to gain unauthorised access to any part of the platform or its infrastructure</li>
        <li>Reverse engineer, decompile, or disassemble any component of the service</li>
        <li>Use the service in any way that violates applicable UK healthcare regulations or GDPR obligations</li>
        <li>Resell or sublicense access to KinetiMap without written consent from esemdot</li>
        <li>Submit false, inaccurate, or misleading patient data</li>
      </ul>

      <h2>7. Data Ownership</h2>
      <p>
        You and your clinic <strong>retain full ownership</strong> of all patient data, clinical records, and business data you input into KinetiMap. esemdot processes this data on your behalf solely to deliver the service. We do not sell, analyse for advertising, or share your clinic's data with third parties except as required to operate the service (see Privacy Policy).
      </p>
      <p>
        You can export your complete dataset at any time via the in-app export tool as a structured ZIP file.
      </p>

      <h2>8. Intellectual Property</h2>
      <p>
        KinetiMap and its original content, features, and functionality are and will remain the exclusive property of esemdot. You are granted a limited, non-exclusive, non-transferable licence to use the service during your active subscription period.
      </p>

      <h2>9. Termination</h2>
      <p>
        You may cancel your subscription at any time via the Billing section of your account. Upon cancellation:
      </p>
      <ul>
        <li>Monthly plans: your access continues until the end of the current billing period</li>
        <li>Yearly plans: you may be eligible for a prorated refund within 30 days of purchase (see Refund Policy)</li>
        <li>We will retain your data for 30 days after cancellation, after which it will be permanently deleted</li>
      </ul>
      <p>
        esemdot reserves the right to suspend or terminate accounts that violate these Terms, with or without notice depending on the severity of the breach.
      </p>

      <h2>10. Disclaimer of Warranties</h2>
      <p>
        KinetiMap is provided "as is" and "as available." We make no warranties — express or implied — regarding the accuracy, reliability, or fitness for a particular clinical purpose of any AI-generated content. All AI-generated SOAP notes, summaries, and recommendations must be reviewed and approved by a qualified clinician before use. KinetiMap is a clinical productivity tool, not a medical device or diagnostic system.
      </p>

      <h2>11. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, esemdot shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of KinetiMap. Our total aggregate liability shall not exceed the amount paid by you in the three months preceding the claim.
      </p>

      <h2>12. Governing Law</h2>
      <p>
        These Terms shall be governed by and construed in accordance with the laws of <strong>England and Wales</strong>. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.
      </p>

      <h2>13. Changes to These Terms</h2>
      <p>
        We may update these Terms from time to time. We will notify active subscribers of material changes via email at least 14 days before they take effect. Continued use of the service after changes constitutes acceptance.
      </p>

      <h2>14. Contact Us</h2>
      <p>
        For any questions about these Terms, please contact us at <a href="mailto:support@kinetimap.app">support@kinetimap.app</a>.
      </p>
    </LegalLayout>
  )
}
