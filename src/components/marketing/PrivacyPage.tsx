import { LegalLayout } from './LegalLayout'

export function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      description="KinetiMap Privacy Policy — how we collect, use, and protect your data in compliance with UK GDPR."
      lastUpdated="June 2026"
    >
      <div className="legal-callout">
        KinetiMap is committed to protecting your privacy and your patients' data. This policy explains how we handle personal data in compliance with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.
      </div>

      <h2>1. Data Controller</h2>
      <p>
        The data controller for KinetiMap is <strong>esemdot</strong>, the company that operates the KinetiMap platform. For data protection enquiries, please contact us at <a href="mailto:support@kinetimap.app">support@kinetimap.app</a>.
      </p>
      <p>
        As a clinic using KinetiMap, you act as a <strong>separate data controller</strong> for your patients' personal data. KinetiMap acts as your <strong>data processor</strong>, processing patient data only on your documented instructions.
      </p>

      <h2>2. Data We Collect</h2>
      <p>We collect the following categories of data when you use KinetiMap:</p>
      <ul>
        <li><strong>Clinic &amp; account information:</strong> clinic name, owner name, email address, billing details, subscription plan</li>
        <li><strong>Practitioner &amp; staff information:</strong> names, email addresses, roles within the clinic</li>
        <li><strong>Patient records:</strong> names, contact details (including WhatsApp numbers), medical history, session notes, SOAP notes, outcome measures, consent records</li>
        <li><strong>Session data:</strong> appointment records, audio transcriptions (used to generate AI SOAP notes), AI-generated note content</li>
        <li><strong>Usage data:</strong> log data, page interactions, feature usage, device and browser type — used to improve the platform</li>
        <li><strong>Payment data:</strong> billing information is processed by our payment provider; we do not store full card details</li>
      </ul>

      <h2>3. How We Use Your Data</h2>
      <p>We use the data we collect for the following purposes:</p>
      <ul>
        <li><strong>Service delivery:</strong> to operate and maintain your KinetiMap account and all its features</li>
        <li><strong>AI processing:</strong> audio recordings from sessions are transcribed and processed to generate SOAP note drafts; recordings are deleted immediately after the note is generated</li>
        <li><strong>Billing:</strong> to process subscription payments and send invoices</li>
        <li><strong>Communications:</strong> to send you product updates, support responses, and legal notices</li>
        <li><strong>Security &amp; fraud prevention:</strong> to protect the platform and your data from unauthorised access</li>
        <li><strong>Platform improvement:</strong> anonymised and aggregated usage analytics to improve features</li>
      </ul>
      <p>
        We do <strong>not</strong> sell your data or your patients' data. We do not use patient data for advertising or train AI models on individually identifiable clinical data.
      </p>

      <h2>4. Legal Basis for Processing</h2>
      <p>Under UK GDPR, our legal bases for processing personal data are:</p>
      <ul>
        <li><strong>Contract performance</strong> — to provide the service you have subscribed to</li>
        <li><strong>Legitimate interests</strong> — for security monitoring, fraud prevention, and anonymised analytics</li>
        <li><strong>Legal obligation</strong> — where required by law</li>
        <li><strong>Consent</strong> — for optional marketing communications (you can withdraw at any time)</li>
      </ul>
      <p>
        For processing <strong>special category health data</strong> (patient clinical records), we rely on Article 9(2)(h) UK GDPR — processing necessary for the provision of health care — and your clinic's role as the responsible data controller.
      </p>

      <h2>5. Patient Data — Clinic Responsibility</h2>
      <p>
        Your clinic is the data controller for all patient personal data held in KinetiMap. This means you are responsible for:
      </p>
      <ul>
        <li>Obtaining valid patient consent for data processing and AI-assisted note-taking</li>
        <li>Responding to patient data subject access requests (DSARs)</li>
        <li>Ensuring patient data is accurate and kept up to date</li>
        <li>Complying with your own ICO registration obligations as a healthcare provider</li>
      </ul>
      <p>
        KinetiMap provides built-in tools to help you fulfil these obligations, including per-patient consent toggles, one-click data export, and right-to-erasure functionality.
      </p>

      <h2>6. Data Retention</h2>
      <ul>
        <li><strong>Session audio recordings:</strong> deleted immediately after SOAP note generation — not stored</li>
        <li><strong>Patient records &amp; SOAP notes:</strong> retained for as long as your clinic subscription is active, plus 30 days after cancellation</li>
        <li><strong>Account data:</strong> retained for the duration of your subscription and deleted within 30 days of account closure</li>
        <li><strong>Billing records:</strong> retained for 7 years as required by UK financial regulations</li>
        <li><strong>Usage logs:</strong> retained for up to 12 months for security and platform improvement purposes</li>
      </ul>

      <h2>7. Third-Party Services</h2>
      <p>KinetiMap uses the following third-party services to deliver the platform:</p>
      <ul>
        <li><strong>Supabase</strong> — database hosting and authentication. Data is stored in EU-based data centres. <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">Supabase Privacy Policy</a></li>
        <li><strong>Meta WhatsApp Business API</strong> — for sending automated patient journey messages. Meta processes message content as per their data processing terms. Patient WhatsApp numbers are transmitted solely for the purpose of message delivery.</li>
        <li><strong>OpenAI / Whisper</strong> — for audio transcription and AI note generation. Audio data is processed transiently and not retained by the AI provider after processing.</li>
        <li><strong>Payment processor</strong> — for subscription billing. Full card details are not stored by KinetiMap.</li>
      </ul>
      <p>
        All third-party processors are bound by appropriate Data Processing Agreements (DPAs) to ensure data is handled securely and lawfully.
      </p>

      <h2>8. International Data Transfers</h2>
      <p>
        Where personal data is transferred outside the UK (e.g., to EU-based servers or US-based processors), we ensure appropriate safeguards are in place, including Standard Contractual Clauses (SCCs) or adequacy decisions as recognised by the UK ICO.
      </p>

      <h2>9. Your Rights Under UK GDPR</h2>
      <p>You have the following rights regarding your personal data:</p>
      <ul>
        <li><strong>Right of access</strong> — request a copy of the personal data we hold about you</li>
        <li><strong>Right to rectification</strong> — request correction of inaccurate data</li>
        <li><strong>Right to erasure</strong> — request deletion of your data ("right to be forgotten")</li>
        <li><strong>Right to restrict processing</strong> — ask us to limit how we use your data</li>
        <li><strong>Right to data portability</strong> — receive your data in a structured, machine-readable format</li>
        <li><strong>Right to object</strong> — object to processing based on legitimate interests</li>
        <li><strong>Right to withdraw consent</strong> — for any processing based on consent, you may withdraw at any time</li>
      </ul>
      <p>
        To exercise any of these rights, email <a href="mailto:support@kinetimap.app">support@kinetimap.app</a>. We will respond within 30 days. You also have the right to lodge a complaint with the <a href="https://ico.org.uk/" target="_blank" rel="noopener noreferrer">Information Commissioner's Office (ICO)</a>.
      </p>

      <h2>10. Security</h2>
      <p>
        We implement industry-standard technical and organisational security measures including encryption in transit (TLS), encryption at rest, role-based access controls, and regular security reviews. However, no system is completely secure — if you believe your account has been compromised, contact us immediately.
      </p>

      <h2>11. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy periodically. We will notify you of material changes via email and update the "Last updated" date at the top of this page. Continued use of the service after changes constitutes acceptance.
      </p>

      <h2>12. Contact Us</h2>
      <p>
        For privacy-related questions, data requests, or to report a concern, please contact us at <a href="mailto:support@kinetimap.app">support@kinetimap.app</a>.
      </p>
    </LegalLayout>
  )
}
