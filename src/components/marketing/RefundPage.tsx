import { LegalLayout } from './LegalLayout'

export function RefundPage() {
  return (
    <LegalLayout
      title="Refund Policy"
      description="KinetiMap Refund Policy — understand cancellation terms, refund eligibility, and how to contact us for billing disputes."
      lastUpdated="June 2026"
    >
      <div className="legal-callout">
        We want you to be completely satisfied with KinetiMap. If something isn't right, please contact us at <a href="mailto:support@kinetimap.app">support@kinetimap.app</a> — we'll do our best to resolve it.
      </div>

      <h2>1. 14-Day Free Trial</h2>
      <p>
        Every KinetiMap plan includes a <strong>14-day free trial</strong>. No credit card is required to start a trial. You will not be charged anything during the trial period. If you choose not to subscribe at the end of the trial, your account will simply be paused — no charge is made.
      </p>

      <h2>2. Monthly Plans</h2>
      <p>
        Monthly subscriptions are billed at the start of each billing cycle. The following terms apply:
      </p>
      <ul>
        <li>You may <strong>cancel at any time</strong> from the Billing section of your account</li>
        <li>Upon cancellation, your access continues until the end of the current paid billing period</li>
        <li><strong>No refunds</strong> are issued for partial months — you retain full access until the period ends</li>
        <li>You will not be charged again after cancellation</li>
      </ul>

      <h2>3. Multi-Month &amp; Yearly Plans</h2>
      <p>
        3-month and 6-month plans are billed upfront as a single payment at the discounted rate. Annual subscriptions follow stricter refund conditions due to the significant upfront discount applied.
      </p>
      <p><strong>3-month &amp; 6-month plans — within 30 days of payment:</strong></p>
      <ul>
        <li>You are eligible for a <strong>full refund</strong>, no questions asked</li>
        <li>Contact us at <a href="mailto:support@kinetimap.app">support@kinetimap.app</a> to request your refund</li>
        <li>After 30 days, no refunds are issued — access continues until the end of the billing term</li>
      </ul>
      <p><strong>Annual subscriptions</strong> may be refunded within <strong>7 days of purchase</strong>, provided <em>all</em> of the following conditions are met:</p>
      <ul>
        <li>No AI SOAP credits have been used</li>
        <li>Fewer than 5 WhatsApp journeys have been sent</li>
        <li>A written refund request is submitted to <a href="mailto:support@kinetimap.app">support@kinetimap.app</a></li>
      </ul>
      <p>
        After 7 days, or if the service has been actively used, annual subscriptions are <strong>non-refundable</strong>. You may cancel at any time to prevent future renewals — your access will continue until the end of the current annual period.
      </p>
      <p>
        Approved refunds are processed back to the original payment method within 5–10 business days.
      </p>


      <h2>4. AI Booster Packs</h2>
      <p>
        AI SOAP Credit Booster Packs (100 / 300 / 500 credits) are add-on purchases and are <strong>non-refundable</strong> once purchased. Credits are consumed as you use AI features and expire at the end of your current billing period.
      </p>
      <p>
        If you believe you were charged for a Booster Pack in error, contact us within 7 days and we will investigate.
      </p>

      <h2>5. Plan Upgrades &amp; Downgrades</h2>
      <p>
        If you upgrade to a higher plan mid-cycle, the remaining value of your current plan will be applied as credit toward the new plan. If you downgrade, the change takes effect at the start of your next billing period — no partial refund is issued for the current period.
      </p>

      <h2>6. Exceptional Circumstances</h2>
      <p>
        We review refund requests on a case-by-case basis for exceptional circumstances — such as technical failures that prevented use of the service for an extended period. To request a discretionary refund, email <a href="mailto:support@kinetimap.app">support@kinetimap.app</a> with your account details and a description of the issue.
      </p>

      <h2>7. How to Cancel or Request a Refund</h2>
      <p>To cancel your subscription:</p>
      <ul>
        <li>Log in to KinetiMap and go to <strong>Settings → Billing</strong></li>
        <li>Click <strong>Cancel Subscription</strong> and follow the prompts</li>
      </ul>
      <p>To request a refund (where eligible):</p>
      <ul>
        <li>Email <a href="mailto:support@kinetimap.app">support@kinetimap.app</a> with your account email and the reason for your request</li>
        <li>We aim to respond within 2 business days</li>
        <li>Approved refunds are processed within 5–10 business days to your original payment method</li>
      </ul>

      <h2>8. Governing Law</h2>
      <p>
        This Refund Policy is governed by the laws of <strong>England and Wales</strong>. Nothing in this policy affects your statutory rights under the Consumer Rights Act 2015 or other applicable UK consumer protection law.
      </p>

      <h2>9. Contact Us</h2>
      <p>
        For billing questions, cancellations, or refund requests, contact our support team at <a href="mailto:support@kinetimap.app">support@kinetimap.app</a>. We're here to help.
      </p>
    </LegalLayout>
  )
}
